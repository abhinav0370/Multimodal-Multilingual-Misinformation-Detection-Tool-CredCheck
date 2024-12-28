import subprocess
import os

def extract_audio(video_path, audio_path="output_audio.wav"):
    if not os.path.isfile(video_path):
        return f"Error: The video file '{video_path}' does not exist."
    try:
        command = [
            "ffmpeg",
            "-i",
            video_path,
            "-q:a",
            "0",
            "-map",
            "a",
            audio_path
        ]
        subprocess.run(command, stdout=subprocess.DEVNULL, stder=subprocess.STDOUT, check=True)
        return f"Audio extracted successfully: {audio_path}"
    except FileNotFoundError:
        return "Error: 'ffmpeg' is not installed or not found in PATH."
    except subprocess.CalledProcessError as e:
        return f"Error during audio extraction: {e}"
