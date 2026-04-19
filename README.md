# Website Starter

This folder is a GitHub Pages-ready starter for the public project website.

## Suggested next step

1. Create a new public repository, for example `llm-review-bias-site`.
2. Copy the contents of this `website/` folder into the root of that new repository.
3. Push to GitHub.
4. In the new repository, enable **GitHub Pages** with:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/ (root)`

Because this site is plain static HTML/CSS/JS, no build step is required for the first version.

## Local preview

From inside `website/`, run any simple static server. For example:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Data source

The site data in `website/data/` is generated from:

- repository config files in `configs/`
- `data/paper_ids_used.csv`
- `_ARR_25____Bias_of_LLM_as_a_reviewer.zip`

To regenerate the data files and downloadable artifacts:

```bash
python website/scripts/extract_site_data.py
```

This also refreshes `website/data/site_config.json`, including the Paper link and
the current research-repository GitHub URL.
