# ACI API Environment Variables

## Required Variables

### Database
```env
DATABASE_URL="postgresql://user:password@localhost:5432/aci_db"
```

### Gemini API
```env
GEMINI_API_KEY="your-gemini-api-key-here"
```

### Authentication (Required for Production)
```env
# JWT secret for access tokens (7 day expiry)
JWT_SECRET="your-secret-key-change-in-production"

# JWT secret for refresh tokens (30 day expiry)
JWT_REFRESH_SECRET="refresh-secret-key-change-in-production"
```

**Security Notes:**
- Use strong, random secrets in production (minimum 32 characters)
- Never commit secrets to version control
- Access tokens expire after 7 days
- Refresh tokens expire after 30 days
- Tokens are signed with HS256 algorithm

### Email Configuration (Required for Email Verification)
```env
# SMTP server settings
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"

# Email sender information
FROM_EMAIL="noreply@acitraining.com"
FROM_NAME="ACI Training Platform"

# Frontend URL for verification links
FRONTEND_URL="http://localhost:3000"
```

**Email Service Notes:**
- **Development**: If `SMTP_USER` and `SMTP_PASS` are not set, emails will be logged to console instead of being sent
- **Gmail Setup**: Use an "App Password" (not your regular password) for `SMTP_PASS`
  - Go to Google Account → Security → 2-Step Verification → App passwords
- **Other Providers**: Adjust `SMTP_HOST`, `SMTP_PORT`, and `SMTP_SECURE` accordingly
  - Gmail: `smtp.gmail.com:587` (secure: false)
  - SendGrid: `smtp.sendgrid.net:587` (secure: false)
  - AWS SES: `email-smtp.region.amazonaws.com:587` (secure: false)
- **Verification Links**: Expire after 24 hours
- **Frontend URL**: Should match your web application URL (e.g., `https://acitraining.com` in production)

## Performance Tuning (Optional)

### Model Selection
Use faster models for better response times:

```env
# Primary model (default: gemini-2.0-flash-exp)
GEMINI_MODEL_PRIMARY="gemini-2.0-flash-exp"

# Fallback model (default: gemini-1.5-flash)
GEMINI_MODEL_FALLBACK="gemini-1.5-flash"
```

**Available Models:**
- `gemini-2.0-flash-exp` - Fastest, good quality (recommended)
- `gemini-1.5-flash` - Fast, good quality
- `gemini-1.5-pro` - Slower, better quality
- `gemini-2.5-pro` - Slowest, best quality

### Timeout Settings
```env
# Max time per LLM call in milliseconds (default: 60000)
GEMINI_TIMEOUT_MS=60000
```

Prevents hanging requests. Default is 60 seconds to accommodate complex prompts with clarity rules. Set to 0 to disable timeout (not recommended).

### Retry Settings
```env
# Number of retries per LLM call (default: 2)
GEMINI_MAX_RETRIES=2

# Base backoff time in milliseconds (default: 1000)
# Actual backoff: base * retry_number (1s, 2s, 3s...)
GEMINI_BACKOFF_BASE_MS=1000
```

**Retry timing examples:**
- `GEMINI_MAX_RETRIES=2, BACKOFF_BASE=1000`: 1s, 2s (total: 3s backoff)
- `GEMINI_MAX_RETRIES=3, BACKOFF_BASE=2000`: 2s, 4s, 6s (total: 12s backoff)

### Attempt Limits
```env
# Max generation attempts per request (default: 2)
COACH_MAX_DRILL_ATTEMPTS=2
```

Each attempt runs full generate → QA → potentially fix cycle.

**Performance impact:**
- `1 attempt`: Fastest (30-60s), may return lower quality
- `2 attempts`: Balanced (60-120s), good quality
- `3 attempts`: Slower (90-180s), best quality

### Fixer Control
```env
# Enable/disable LLM-based drill fixes (default: 0)
USE_LLM_FIXER=0
```

**Options:**
- `0` - Disabled (faster, ~30s saved per PATCHABLE drill)
- `1` - Enabled (slower, better quality fixes)

## Development Settings

### Logging
```env
# Enable postprocess logging (default: 0)
LOG_POSTPROC=1

# Return best attempt even if QA fails (default: 0)
ACI_QA_DEV_FAIL_OPEN=1
```

### Data Persistence
```env
# Save drills to database (default: 1)
SAVE_DRILLS=1
```

## Performance Profiles

### Speed-Optimized (Fast Response)
```env
GEMINI_MODEL_PRIMARY="gemini-1.5-flash"
GEMINI_MODEL_FALLBACK="gemini-1.5-flash"
GEMINI_TIMEOUT_MS=45000
GEMINI_MAX_RETRIES=1
GEMINI_BACKOFF_BASE_MS=1000
COACH_MAX_DRILL_ATTEMPTS=1
USE_LLM_FIXER=0
```
**Expected time:** 30-60 seconds

### Balanced (Recommended - Default)
```env
GEMINI_MODEL_PRIMARY="gemini-2.0-flash-exp"
GEMINI_MODEL_FALLBACK="gemini-1.5-flash"
GEMINI_TIMEOUT_MS=60000
GEMINI_MAX_RETRIES=2
GEMINI_BACKOFF_BASE_MS=1000
COACH_MAX_DRILL_ATTEMPTS=2
USE_LLM_FIXER=0
```
**Expected time:** 60-120 seconds

### Quality-Optimized (Best Results)
```env
GEMINI_MODEL_PRIMARY="gemini-1.5-pro"
GEMINI_MODEL_FALLBACK="gemini-1.5-flash"
GEMINI_TIMEOUT_MS=45000
GEMINI_MAX_RETRIES=3
GEMINI_BACKOFF_BASE_MS=2000
COACH_MAX_DRILL_ATTEMPTS=3
USE_LLM_FIXER=1
```
**Expected time:** 90-180 seconds

## Troubleshooting

### "API_QUOTA_EXCEEDED" errors
- Gemini free tier has daily limits
- Wait or upgrade to paid tier
- Reduce `COACH_MAX_DRILL_ATTEMPTS` to conserve quota

### "API_TIMEOUT" errors
- Increase `GEMINI_TIMEOUT_MS`
- Switch to faster model
- Check network connectivity

### Slow responses (>60s)
- Use `gemini-2.0-flash-exp` model
- Set `GEMINI_MAX_RETRIES=1`
- Set `COACH_MAX_DRILL_ATTEMPTS=1`
- Disable fixer: `USE_LLM_FIXER=0`

### Poor quality results
- Use `gemini-1.5-pro` model
- Increase `COACH_MAX_DRILL_ATTEMPTS`
- Enable fixer: `USE_LLM_FIXER=1`

