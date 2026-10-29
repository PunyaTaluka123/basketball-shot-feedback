import json
import numpy as np
import mediapipe as mp
import cv2
import traceback
import os
import sys

sys.stdout = sys.stderr


os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'  # Suppress TensorFlow logs
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'  # Optional: silence oneDNN warnings

# Set DEBUG_FRAMES=1 to write annotated ball/wrist frames to the working directory
DEBUG_FRAMES = os.environ.get('DEBUG_FRAMES') == '1'


def calculate_angle(a, b, c):
    """Calculate angle between three points"""
    try:
        a = np.array(a)
        b = np.array(b)
        c = np.array(c)

        radians = np.arctan2(c[1]-b[1], c[0]-b[0]) - \
            np.arctan2(a[1]-b[1], a[0]-b[0])
        angle = np.abs(radians * 180.0 / np.pi)

        if angle > 180.0:
            angle = 360 - angle
        return angle
    except Exception as e:
        print(json.dumps(
            {"error": f"Error calculating angle: {str(e)}"}), flush=True)
        sys.exit(1)


IDEAL_ELBOW_ANGLE = 130
IDEAL_SHOULDER_ANGLE = 30
IDEAL_WRIST_ANGLE = 120


def analyze_shot(video_path):
    try:
        print("Starting video analysis...", file=sys.stderr, flush=True)

        if not os.path.exists(video_path):
            raise Exception(f"Video file does not exist: {video_path}")

        if not os.access(video_path, os.R_OK):
            raise Exception(f"Video file is not readable: {video_path}")

        mp_pose = mp.solutions.pose  # type: ignore
        pose = mp_pose.Pose(min_detection_confidence=0.5,
                            min_tracking_confidence=0.5)

        print(f"Opening video file: {video_path}", file=sys.stderr, flush=True)
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise Exception(f"Could not open video file: {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS)
        if fps <= 0:
            raise Exception(f"Invalid FPS value: {fps}")

        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if frame_count <= 0:
            raise Exception(f"Invalid frame count: {frame_count}")

        print(
            f"Video properties - FPS: {fps}, Frame count: {frame_count}", file=sys.stderr, flush=True)

        analysis_data = {
            'fps': fps,
            'frame_count': frame_count,
            'frames': []
        }

        frame_number = 0
        error_data = []  # New: store error info per frame
        ball_positions = []  # Store detected ball positions per frame
        frame_snapshots = []  # Track per-frame ball/wrist data
        hip_y_pixels = []  # Track hip vertical position (pixels)
        while cap.isOpened():
            success, frame = cap.read()
            if not success:
                break

            if frame_number % 5 != 0:
                frame_number += 1
                continue

            image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = pose.process(image)

            # --- Ball Detection ---
            # Convert to HSV for color thresholding
            hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
            # Orange color range (may need tuning for your videos)
            # Lower V to 60, S to 120, H to 3
            lower_orange = np.array([3, 120, 30])
            upper_orange = np.array([25, 255, 255])
            mask = cv2.inRange(hsv, lower_orange, upper_orange)
            # Blur to reduce noise
            mask = cv2.GaussianBlur(mask, (9, 9), 2, 2)  # type: ignore
            # Hough Circle Transform
            circles = cv2.HoughCircles(mask, cv2.HOUGH_GRADIENT, dp=1.2, minDist=30,
                                       param1=50, param2=15, minRadius=5, maxRadius=50)
            ball_pos = None
            if circles is not None:
                circles = np.uint16(np.around(circles))
                # Take the largest circle (assume it's the ball)
                # type: ignore
                largest = max(circles[0, :], key=lambda c: c[2])
                ball_pos = (int(largest[0]), int(largest[1]))
            ball_positions.append(ball_pos)
            # --- End Ball Detection ---

            wrist_px = None
            hip_y_px = None
            hip_point = None
            palm_point = None
            analysis_idx = None

            if results.pose_landmarks:
                landmarks = results.pose_landmarks.landmark
                shoulder = [
                    landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].x,
                    landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].y
                ]
                elbow = [
                    landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value].x,
                    landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value].y
                ]
                wrist = [
                    landmarks[mp_pose.PoseLandmark.RIGHT_WRIST.value].x,
                    landmarks[mp_pose.PoseLandmark.RIGHT_WRIST.value].y
                ]
                # Save wrist pixel position for ball proximity check
                h, w, _ = frame.shape
                wrist_px = (int(wrist[0] * w), int(wrist[1] * h))
                # Hip vertical position in pixels (use right hip if available, else left)
                try:
                    right_hip = landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value]
                    hip_point = [right_hip.x, right_hip.y]
                    hip_y_px = int(right_hip.y * h)
                except Exception:
                    try:
                        left_hip = landmarks[mp_pose.PoseLandmark.LEFT_HIP.value]
                        hip_point = [left_hip.x, left_hip.y]
                        hip_y_px = int(left_hip.y * h)
                    except Exception:
                        hip_y_px = None
                        hip_point = None

                if hip_y_px is not None:
                    hip_y_pixels.append(hip_y_px)

                finger_landmarks = []
                for landmark_id in [
                    mp_pose.PoseLandmark.RIGHT_INDEX,
                    mp_pose.PoseLandmark.RIGHT_THUMB,
                    mp_pose.PoseLandmark.RIGHT_PINKY
                ]:
                    try:
                        landmark = landmarks[landmark_id.value]
                        finger_landmarks.append(landmark)
                    except Exception:
                        continue

                if finger_landmarks:
                    avg_x = sum(lm.x for lm in finger_landmarks) / len(finger_landmarks)
                    avg_y = sum(lm.y for lm in finger_landmarks) / len(finger_landmarks)
                    palm_point = [avg_x, avg_y]
                else:
                    palm_point = None

                elbow_angle = calculate_angle(shoulder, elbow, wrist)
                if hip_point is not None:
                    shoulder_angle = calculate_angle(
                        hip_point, shoulder, elbow)
                else:
                    shoulder_angle = calculate_angle(
                        [shoulder[0], max(0.0, shoulder[1] - 0.2)],
                        shoulder,
                        elbow
                    )

                if palm_point is not None:
                    wrist_angle = calculate_angle(
                        elbow, wrist, palm_point)
                else:
                    wrist_angle = calculate_angle(
                        elbow, wrist, [wrist[0] + 0.2, wrist[1]])

                # Calculate errors
                elbow_error = abs(elbow_angle - IDEAL_ELBOW_ANGLE)
                shoulder_error = abs(shoulder_angle - IDEAL_SHOULDER_ANGLE)
                wrist_error = abs(wrist_angle - IDEAL_WRIST_ANGLE)
                collective_error = elbow_error + shoulder_error + wrist_error

                # Store error data for this frame
                error_data.append({
                    'frame_number': frame_number,
                    'timestamp': frame_number / fps,
                    'elbow_error': elbow_error,
                    'shoulder_error': shoulder_error,
                    'wrist_error': wrist_error,
                    'collective_error': collective_error
                })

                frame_data = {
                    'frame_number': frame_number,
                    'timestamp': frame_number / fps,
                    'angles': {
                        'elbow': elbow_angle,
                        'shoulder': shoulder_angle,
                        'wrist': wrist_angle
                    },
                    'suggestions': []
                }

                if elbow_angle < 80:
                    frame_data['suggestions'].append(
                        "Straighten your elbow to at least 80 degrees")
                elif elbow_angle > 100:
                    frame_data['suggestions'].append(
                        "Bend your elbow to about 100 degrees or less")

                if shoulder_angle < 45:
                    frame_data['suggestions'].append(
                        "Raise your shooting arm (shoulder angle under 45 degrees)")
                elif shoulder_angle > 90:
                    frame_data['suggestions'].append(
                        "Lower your shooting arm (shoulder angle over 90 degrees)")

                if wrist_angle < 80:
                    frame_data['suggestions'].append(
                        "Straighten your wrist to at least 80 degrees")
                elif wrist_angle > 100:
                    frame_data['suggestions'].append(
                        "Bend your wrist more, towards 80-100 degrees")

                analysis_data['frames'].append(frame_data)
                analysis_idx = len(analysis_data['frames']) - 1

            # Save debug frame after computing wrist info to avoid duplicate writes
            if DEBUG_FRAMES and frame_number % 10 == 0:
                debug_frame = frame.copy()
                if ball_pos is not None:
                    cv2.circle(debug_frame, ball_pos, 10, (0, 255, 0), 2)
                if wrist_px is not None:
                    cv2.circle(debug_frame, wrist_px, 10, (255, 0, 0), 2)
                cv2.imwrite(
                    f"debug_ball_frame_{frame_number}.jpg", debug_frame)

            frame_snapshots.append({
                'frame_number': frame_number,
                'timestamp': frame_number / fps,
                'ball': ball_pos,
                'wrist': wrist_px,
                'analysis_idx': analysis_idx
            })
            frame_number += 1

        cap.release()
        pose.close()
        cv2.destroyAllWindows()

        if not analysis_data['frames']:
            raise Exception("No frames were analyzed successfully")

        # Add error data and ball positions to output
        analysis_data['error_data'] = error_data
        analysis_data['ball_positions'] = ball_positions

        # --- Release Frame Detection (Ball Proximity) ---
        # Find last frame where ball is close to wrist
        release_snapshot = None
        release_frame = None
        max_dist = 60  # pixels, may need tuning
        for idx in range(len(frame_snapshots) - 1, -1, -1):
            snapshot = frame_snapshots[idx]
            ball = snapshot['ball']
            wrist = snapshot['wrist']
            if ball is not None and wrist is not None:
                dist = np.linalg.norm(np.array(ball) - np.array(wrist))
                if dist < max_dist:
                    release_snapshot = snapshot
                    analysis_idx = snapshot.get('analysis_idx')
                    if analysis_idx is not None and 0 <= analysis_idx < len(analysis_data['frames']):
                        release_frame = analysis_data['frames'][analysis_idx]
                        break

        if release_frame is None:
            # fallback: use max wrist angle
            wrist_angles = [f['angles']['wrist']
                            for f in analysis_data['frames']]
            release_idx = int(np.argmax(wrist_angles))
            release_frame = analysis_data['frames'][release_idx]
        analysis_data['release_angles'] = {
            'frame_number': release_frame['frame_number'],
            'timestamp': release_frame['timestamp'],
            'elbow': release_frame['angles']['elbow'],
            'shoulder': release_frame['angles']['shoulder'],
            'wrist': release_frame['angles']['wrist']
        }
        # --- End Release Frame Detection ---

        # --- Jump Type Estimation ---
        # Compute vertical displacement of the hip: larger upward motion => jump
        valid_hip_positions = [y for y in hip_y_pixels if y is not None]
        jump_info = {
            'type': 'unknown',
            'max_vertical_displacement_px': 0,
            'baseline_hip_y_px': None,
            'min_hip_y_px': None
        }
        if len(valid_hip_positions) >= 3:
            baseline = int(
                np.median(valid_hip_positions[:max(3, len(valid_hip_positions)//10)]))
            min_y = int(min(valid_hip_positions))
            # y increases downward; upward motion reduces y
            displacement = max(0, baseline - min_y)
            jump_info['baseline_hip_y_px'] = baseline
            jump_info['min_hip_y_px'] = min_y
            jump_info['max_vertical_displacement_px'] = int(displacement)
            # Heuristic thresholds (may be tuned based on footage scale)
            if displacement < 5:
                jump_info['type'] = 'set_shot'
            elif displacement < 20:
                jump_info['type'] = 'small_hop'
            else:
                jump_info['type'] = 'jump_shot'
        analysis_data['jump'] = jump_info
        # --- End Jump Type Estimation ---

        return analysis_data

    except Exception as e:
        error_msg = f"Error in analyze_shot: {str(e)}\n{traceback.format_exc()}"
        print(json.dumps({"error": error_msg}), flush=True)
        sys.exit(1)


if __name__ == "__main__":
    print("Script started", file=sys.stderr, flush=True)

    if len(sys.argv) != 2:
        print(json.dumps({"error": "Please provide video path"}), flush=True)
        sys.exit(1)

    video_path = sys.argv[1]

    try:
        print(
            f"Starting analysis for video: {video_path}", file=sys.stderr, flush=True)
        analysis = analyze_shot(video_path)
        sys.stdout = sys.__stdout__
        print(json.dumps(analysis), flush=True)  # ONLY output JSON to stdout
        sys.stdout.flush()
    except Exception as e:
        error_msg = f"Error in main: {str(e)}\n{traceback.format_exc()}"
        print(json.dumps({"error": error_msg}), flush=True)
        sys.exit(1)
