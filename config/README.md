# config/

This directory holds secret credential files that are **never committed to git**.

## google-service-account.json

Service account key for Google Vertex AI (Nano Banana Pro).

- **Project:** `lumina-488103`
- **Service account:** `lumina-ai-app-780@lumina-488103.iam.gserviceaccount.com`
- **Required role:** Vertex AI User (`roles/aiplatform.user`)

To set up:
1. Go to GCP Console → IAM & Admin → Service Accounts
2. Select `lumina-ai-app-780` → Keys → Add Key → JSON
3. Save the downloaded file as `config/google-service-account.json`
4. Ensure `GOOGLE_APPLICATION_CREDENTIALS=./config/google-service-account.json` is set in `.env`

**Never commit this file. It is listed in .gitignore.**
