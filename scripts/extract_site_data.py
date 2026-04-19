import csv
import json
import subprocess
import re
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
WEBSITE = ROOT / "website"
DATA_DIR = WEBSITE / "data"
DOWNLOADS_DIR = WEBSITE / "downloads"
ZIP_PATH = ROOT / "_ARR_25____Bias_of_LLM_as_a_reviewer.zip"


MODEL_NAME_MAP = {
    "latex_DeepSeek-R1-Distill-Llama-8B.tex": "DeepSeek-R1-Distill-Llama-8B",
    "latex_DeepSeek-R1-Distill-Qwen-32B.tex": "DeepSeek-R1-Distill-Qwen-32B",
    "latex_GPT-4o-Mini.tex": "GPT-4o-Mini",
    "latex_Gemini_2.0_Flash-Lite.tex": "Gemini-2.0-Flash-Lite",
    "latex_Meta-Llama-3.1-70B-Instruct.tex": "Meta-Llama-3.1-70B-Instruct",
    "latex_Meta-Llama-3.1-8B-Instruct.tex": "Meta-Llama-3.1-8B-Instruct",
    "latex_Ministral-8B-Instruct-2410.tex": "Ministral-8B-Instruct-2410",
    "latex_Mistral-Small-Instruct-2409.tex": "Mistral-Small-Instruct-2409",
    "latex_QwQ-32B.tex": "QwQ-32B",
}


def ensure_dirs():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)


def write_json(path: Path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def parse_triplet(cell, focus_label, contrast_label):
    values = [float(value) for value in re.findall(r"\d+(?:\.\d+)?", cell)]
    if len(values) < 3:
        raise ValueError(f"Could not parse triplet from cell: {cell}")
    return {
        "focusLabel": focus_label,
        "contrastLabel": contrast_label,
        "focus": values[0],
        "contrast": values[1],
        "tie": values[2],
    }


def parse_main_table(zip_file: zipfile.ZipFile):
    tex = zip_file.read("results/main_table.tex").decode("utf-8", errors="replace")
    rows = []
    current_model = None
    current_label = None

    for raw_line in tex.splitlines():
        line = raw_line.strip()
        if "&" not in line or "textbf{Model}" in line or "makecell[c]{\\textit{RS}" in line:
            continue
        if "\\cmidrule" in line or "\\midrule" in line or "\\bottomrule" in line:
            continue
        if not line.endswith("\\\\"):
            continue

        cells = [cell.strip() for cell in line[:-2].split("&")]
        if len(cells) != 6:
            continue

        model_match = re.search(r"\\makecell\[c\]\{([^}]*)\}", cells[0])
        if model_match:
            current_model = model_match.group(1)

        if "Accepted" in cells[1]:
            current_label = "Accepted"
        elif "Rejected" in cells[1]:
            current_label = "Rejected"

        metric_type = cells[2]
        if metric_type not in {"Hard", "Soft"}:
            continue

        rows.append(
            {
                "model": current_model,
                "label": current_label,
                "metricType": metric_type,
                "affiliation": parse_triplet(cells[3], "RS", "RW"),
                "gender_mit": parse_triplet(cells[4], "male", "female"),
                "gender_gondar": parse_triplet(cells[5], "male", "female"),
            }
        )

    return rows


def parse_gender_dimension():
    gender_entries = read_json(ROOT / "configs" / "gender.json")
    male_authors = sorted({entry["author"] for entry in gender_entries if entry["gender"] == "male" and entry["affiliation"] == "MIT"})
    female_authors = sorted({entry["author"] for entry in gender_entries if entry["gender"] == "female" and entry["affiliation"] == "MIT"})
    affiliations = []
    seen = set()
    for entry in gender_entries:
        if not entry["affiliation"]:
            continue
        key = (entry["affiliation"], entry["country"])
        if key not in seen:
            seen.add(key)
            affiliations.append({"affiliation": entry["affiliation"], "country": entry["country"]})
    return {
        "maleAuthors": male_authors,
        "femaleAuthors": female_authors,
        "affiliations": affiliations,
        "entryCount": len(gender_entries),
    }


def parse_affiliation_dimension():
    ranked = read_json(ROOT / "configs" / "affiliations_ranked_stronger_vs_ranked_lower_global.json")
    same_country = read_json(ROOT / "configs" / "author_affiliation_same_country.json")
    country_pairs = {}
    for entry in same_country:
        country = entry["country"]
        country_pairs.setdefault(country, {"country": country})
        if entry["gender"] == "male":
            country_pairs[country]["maleAuthor"] = entry["author"]
        elif entry["gender"] == "female":
            country_pairs[country]["femaleAuthor"] = entry["author"]

    return {
        "rankedStronger": ranked["affiliations"]["ranked_stronger"],
        "rankedLower": ranked["affiliations"]["ranked_lower"],
        "countryAuthorPairs": sorted(country_pairs.values(), key=lambda item: item["country"]),
    }


def parse_profile_dimension(path: Path, source_key: str, output_key: str):
    rows = read_json(path)
    return {
        "profiles": [
            {
                "author": row["author"],
                "affiliationType": row["affiliation_type"],
                "affiliation": row["affiliation"],
                output_key: row[source_key],
            }
            for row in rows
        ]
    }


def parse_affiliation_rankings(zip_file: zipfile.ZipFile):
    rankings = {}
    for member in zip_file.namelist():
        if not member.startswith("appendix_tables/hypothesis_test/") or not member.endswith(".tex"):
            continue
        filename = Path(member).name
        model_name = MODEL_NAME_MAP.get(filename, filename.replace("latex_", "").replace(".tex", ""))
        text = zip_file.read(member).decode("utf-8", errors="replace")
        rows = []
        for raw_line in text.splitlines():
            line = raw_line.strip()
            if not line or line.startswith("\\") or "&" not in line or "Rank &" in line:
                continue
            if not line.endswith("\\\\"):
                continue
            cells = [cell.strip() for cell in line[:-2].split(" & ")]
            if len(cells) != 6:
                continue
            rank = int(re.findall(r"\d+", cells[0])[0])
            affiliation = cells[1].replace("\\&", "&")
            row_type = "RS" if "RS" in cells[2] else "RW"
            wins = int(re.findall(r"\d+", cells[3])[0])
            matches = int(re.findall(r"\d+", cells[4])[0])
            win_rate = float(re.findall(r"\d+(?:\.\d+)?", cells[5])[0])
            rows.append(
                {
                    "rank": rank,
                    "affiliation": affiliation,
                    "type": row_type,
                    "wins": wins,
                    "matches": matches,
                    "winRate": win_rate,
                }
            )
        rankings[model_name] = rows
    return rankings


def extract_downloads(zip_file: zipfile.ZipFile):
    artifacts = []
    for member in zip_file.namelist():
        if not member.endswith(".pdf"):
            continue
        target = DOWNLOADS_DIR / member
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(zip_file.read(member))

        category = "Heatmap" if "llm_rating_heatmaps" in member else "Paper artifact"
        artifacts.append(
            {
                "title": Path(member).stem.replace("_", " "),
                "filename": Path(member).name,
                "category": category,
                "url": f"downloads/{member}".replace("\\", "/"),
            }
        )
    artifacts.sort(key=lambda item: (item["category"], item["filename"]))
    return artifacts


def count_papers():
    with open(ROOT / "data" / "paper_ids_used.csv", "r", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        return sum(1 for _ in reader)


def get_repo_url():
    try:
        result = subprocess.run(
            ["git", "remote", "get-url", "origin"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=True,
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        return ""

    url = result.stdout.strip()
    if url.endswith(".git"):
        url = url[:-4]
    return url


def main():
    ensure_dirs()
    with zipfile.ZipFile(ZIP_PATH, "r") as zip_file:
        main_table = parse_main_table(zip_file)
        rankings = parse_affiliation_rankings(zip_file)
        downloads = extract_downloads(zip_file)

    gender = parse_gender_dimension()
    affiliation = parse_affiliation_dimension()
    seniority = parse_profile_dimension(
        ROOT / "configs" / "about_author_profiles.json",
        "about_author",
        "aboutAuthor",
    )
    publication_history = parse_profile_dimension(
        ROOT / "configs" / "publication_history.json",
        "author_publication_history",
        "authorPublicationHistory",
    )

    summary = {
        "dimensionCount": 4,
        "modelCount": len({row["model"] for row in main_table}),
        "paperCount": count_papers(),
        "mainTableRowCount": len(main_table),
    }
    site_config = {
        "title": "Justice in Judgment",
        "subtitle": "Unveiling (Hidden) Bias in LLM-assisted Peer Reviews",
        "paperUrl": "https://arxiv.org/abs/2509.13400",
        "codeUrl": get_repo_url(),
    }

    write_json(DATA_DIR / "site_config.json", site_config)
    write_json(DATA_DIR / "site_summary.json", summary)
    write_json(DATA_DIR / "main_table.json", main_table)
    write_json(DATA_DIR / "gender_dimension.json", gender)
    write_json(DATA_DIR / "affiliation_dimension.json", affiliation)
    write_json(DATA_DIR / "seniority_dimension.json", seniority)
    write_json(DATA_DIR / "publication_history_dimension.json", publication_history)
    write_json(DATA_DIR / "affiliation_rankings.json", rankings)
    write_json(DATA_DIR / "downloads.json", downloads)

    print("Website data refreshed.")


if __name__ == "__main__":
    main()
