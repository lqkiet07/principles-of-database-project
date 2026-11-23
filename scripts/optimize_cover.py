# -*- coding: utf-8 -*-
import docx

def optimize_cover_pages(doc):
    # Paragraphs 0 to 59
    # Keep only 2 empty paragraphs in each gap:
    # Gap 1: between 2 and 10 (keep 2)
    # Gap 2: between 16 and 30 (keep 3)
    # Gap 3: between 33 and 42 (keep 2)
    # Gap 4: between 48 and 57 (keep 2)
    to_remove = [
        5, 6, 7, 8, 9,
        20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
        36, 37, 38, 39, 40, 41,
        51, 52, 53, 54, 55, 56
    ]
    # Remove from bottom up
    for idx in sorted(to_remove, reverse=True):
        if idx < len(doc.paragraphs):
            p = doc.paragraphs[idx]
            if not p.text.strip():
                p._element.getparent().remove(p._element)
    print("Cover pages optimized. Paragraphs now:", len(doc.paragraphs))

if __name__ == "__main__":
    doc = docx.Document("template_cover.docx")
    optimize_cover_pages(doc)
    doc.save("template_cover.docx")
