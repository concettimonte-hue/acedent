"""Optional asset regeneration after a static build. Requires fonttools and brotli."""

from html.parser import HTMLParser
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont


class VisibleCharacters(HTMLParser):
    def __init__(self):
        super().__init__()
        self.characters = set(range(32, 127))
        self.in_script_or_style = False

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.in_script_or_style = True

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.in_script_or_style = False

    def handle_data(self, text):
        if not self.in_script_or_style:
            self.characters.update(map(ord, text))


def main():
    root = Path(__file__).resolve().parents[1]
    dist = root / "dist"
    parser = VisibleCharacters()
    for page in [dist / "index.html", dist / "works.html", *sorted((dist / "works").glob("*.html"))]:
        parser.feed(page.read_text(encoding="utf-8"))
    parser.close()

    source = root / "node_modules/pretendard/dist/public/variable/PretendardVariable.ttf"
    with TTFont(source, recalcTimestamp=False) as font:
        options = subset.Options()
        options.name_IDs = ["*"]
        options.name_languages = ["*"]
        options.layout_features = ["*"]
        subsetter = subset.Subsetter(options=options)
        subsetter.populate(unicodes=parser.characters)
        subsetter.subset(font)

        # Preserve copyright and OFL records; use a new family name for the derivative.
        names = {1: "AceDent UI", 2: "Regular", 3: "AceDent UI 1.0", 4: "AceDent UI Regular",
                 6: "AceDentUI-Regular", 16: "AceDent UI", 17: "Regular", 25: "AceDentUI"}
        for record in font["name"].names:
            if record.nameID in names:
                record.string = names[record.nameID].encode(record.getEncoding())
            elif record.nameID > 255:
                name = record.toUnicode()
                if "Pretendard" in name:
                    record.string = name.replace("Pretendard", "AceDentUI").encode(record.getEncoding())
        font.flavor = "woff2"
        font.save(root / "app/ace-dent-ui.woff2")


if __name__ == "__main__":
    main()
