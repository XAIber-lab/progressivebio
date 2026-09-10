from __future__ import annotations

import subprocess
from pathlib import Path

from PIL import Image


REPO_ROOT = Path(__file__).resolve().parents[2]
ANIMATIONS_ROOT = REPO_ROOT / "visualization" / "animations_smooth"
RSVG_CONVERT = "/opt/homebrew/bin/rsvg-convert"
FRAME_DURATION_MS = 120
OUTPUT_WIDTH = 1000


def render_svg_to_png(svg_path: Path, png_path: Path) -> None:
    subprocess.run(
        [
            RSVG_CONVERT,
            "-f",
            "png",
            "-w",
            str(OUTPUT_WIDTH),
            "-o",
            str(png_path),
            str(svg_path),
        ],
        check=True,
    )


def create_gif_from_frame_dir(frame_dir: Path) -> Path:
    svg_paths = sorted(frame_dir.glob("*.svg"))
    if not svg_paths:
        raise ValueError(f"No SVG frames found in {frame_dir}")

    graph_dir = frame_dir.parent
    method = frame_dir.name.removeprefix(".").removesuffix("_frames")
    temp_png_dir = graph_dir / f".{method}_png"
    temp_png_dir.mkdir(parents=True, exist_ok=True)

    png_paths: list[Path] = []
    for svg_path in svg_paths:
        png_path = temp_png_dir / f"{svg_path.stem}.png"
        render_svg_to_png(svg_path, png_path)
        png_paths.append(png_path)

    images = [Image.open(path).convert("RGBA") for path in png_paths]
    durations = [FRAME_DURATION_MS] * len(images)

    output_path = graph_dir / f"{method}.gif"
    images[0].save(
        output_path,
        save_all=True,
        append_images=images[1:],
        duration=durations,
        loop=0,
        disposal=2,
        optimize=False,
    )

    for image in images:
        image.close()
    for png_path in png_paths:
        png_path.unlink(missing_ok=True)
    temp_png_dir.rmdir()

    return output_path


def main() -> None:
    created: list[Path] = []
    for graph_dir in sorted(path for path in ANIMATIONS_ROOT.iterdir() if path.is_dir()):
        for frame_dir in sorted(path for path in graph_dir.iterdir() if path.is_dir() and path.name.endswith("_frames")):
            output_path = create_gif_from_frame_dir(frame_dir)
            created.append(output_path)
            print(f"Created {output_path.relative_to(REPO_ROOT)}")

    print(f"Created {len(created)} tweened animation(s)")


if __name__ == "__main__":
    main()
