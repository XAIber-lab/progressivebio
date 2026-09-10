from __future__ import annotations

import re
import subprocess
from pathlib import Path

from PIL import Image


REPO_ROOT = Path(__file__).resolve().parents[2]
FIGURES_ROOT = REPO_ROOT / "visualization" / "figures"
ANIMATIONS_ROOT = REPO_ROOT / "visualization" / "animations"
RSVG_CONVERT = "/opt/homebrew/bin/rsvg-convert"

FRAME_DURATION_MS = 350
FINAL_FRAME_DURATION_MS = 900


FRAME_PATTERN = re.compile(r"^(?P<method>.+)_iteration(?P<iteration>\d+)\.svg$")


def iter_graph_dirs() -> list[Path]:
    return sorted(
        path
        for path in FIGURES_ROOT.iterdir()
        if path.is_dir()
    )


def collect_sequences(graph_dir: Path) -> dict[str, list[Path]]:
    sequences: dict[str, list[tuple[int, Path]]] = {}
    for svg_path in graph_dir.glob("*.svg"):
        match = FRAME_PATTERN.match(svg_path.name)
        if not match:
            continue
        method = match.group("method")
        iteration = int(match.group("iteration"))
        sequences.setdefault(method, []).append((iteration, svg_path))

    ordered: dict[str, list[Path]] = {}
    for method, items in sequences.items():
        items.sort(key=lambda item: item[0])
        ordered[method] = [path for _, path in items]
    return ordered


def render_svg_to_png(svg_path: Path, png_path: Path) -> None:
    subprocess.run(
        [RSVG_CONVERT, "-f", "png", "-o", str(png_path), str(svg_path)],
        check=True,
    )


def create_gif(method: str, graph_dir: Path, frames: list[Path]) -> Path:
    output_dir = ANIMATIONS_ROOT / graph_dir.name
    output_dir.mkdir(parents=True, exist_ok=True)

    temp_dir = output_dir / f".{method}_frames"
    temp_dir.mkdir(parents=True, exist_ok=True)

    png_paths: list[Path] = []
    for index, svg_path in enumerate(frames, start=1):
        png_path = temp_dir / f"{index:02d}.png"
        render_svg_to_png(svg_path, png_path)
        png_paths.append(png_path)

    images = [Image.open(path).convert("RGBA") for path in png_paths]
    durations = [FRAME_DURATION_MS] * len(images)
    durations[-1] = FINAL_FRAME_DURATION_MS

    output_path = output_dir / f"{method}.gif"
    images[0].save(
        output_path,
        save_all=True,
        append_images=images[1:],
        duration=durations,
        loop=0,
        disposal=2,
    )

    for image in images:
        image.close()
    for png_path in png_paths:
        png_path.unlink(missing_ok=True)
    temp_dir.rmdir()

    return output_path


def main() -> None:
    created: list[Path] = []

    for graph_dir in iter_graph_dirs():
        sequences = collect_sequences(graph_dir)
        for method, frames in sorted(sequences.items()):
            if len(frames) != 10:
                print(f"Skipping {graph_dir.name}/{method}: expected 10 frames, found {len(frames)}")
                continue
            output_path = create_gif(method, graph_dir, frames)
            created.append(output_path)
            print(f"Created {output_path.relative_to(REPO_ROOT)}")

    print(f"Created {len(created)} animation(s)")


if __name__ == "__main__":
    main()
