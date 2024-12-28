import subprocess
import os

def extract_audio(video_path, audio_path="output_audio.wav"):
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
    except subprocess.CalledProcessError as e:
        return f"Error: {e}"
