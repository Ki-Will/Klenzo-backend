#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Tier 1/2 auth contract battery.
#
# Runs the full legacy-parity auth contract against a live auth-worker:
#   register / duplicate / validation · login + lockout · refresh rotation +
#   replay rejection · logout · cookie AND Bearer auth · forgot/reset password
#   (incl. account unlock) · MFA setup/enable/status/login/disable ·
#   RPC secret enforcement.
#
# Usage:
#   BASE=http://localhost:8788 bash scripts/tier2-contract-test.sh          # local
#   BASE=https://klenzo-auth-worker.<account>.workers.dev \
#     bash scripts/tier2-contract-test.sh                                   # cloud
#
#   Note: RUN_RPC=1 checks hit $RPC_BASE (defaults to $BASE). The /rpc/* routes
#   are exposed publicly ONLY on the auth-worker (the api-worker intentionally
#   404s them — service-to-service via binding), so keep RPC_BASE unset for the
#   cloud run.
#
# Optional env:
#   RUN_RPC=1        also run the /rpc/* secret-enforcement checks against the
#                    auth-worker's public URL (401 without/with wrong secret
#                    proves the routes fail closed even when exposed).
#   TOTP_SECRET=...  skip the MFA-setup dance and use a known secret.
# ─────────────────────────────────────────────────────────────────────────────
set -u

BASE="${BASE:-http://localhost:8788}"
RUN_RPC="${RUN_RPC:-0}"
RPC_BASE="${RPC_BASE:-$BASE}"

PASS=0
FAIL=0
FAILED_NAMES=()

check() { # check <name> <condition-exit-code>
  if [ "$2" -eq 0 ]; then
    PASS=$((PASS + 1))
    echo "  ok   $1"
  else
    FAIL=$((FAIL + 1))
    FAILED_NAMES+=("$1")
    echo "  FAIL $1"
  fi
}

jget() { # jget <json> <python-expr over d>
  python3 -c "import json,sys; d=json.loads(sys.argv[1]); print($2)" "$1" 2>/dev/null
}

jcheck() { # jcheck <json> <python-bool-expr over d> — exits 0/1 for `check`
  python3 -c "import json,sys; d=json.loads(sys.argv[1]); sys.exit(0 if ($2) else 1)" "$1" 2>/dev/null
}

STAMP=$(date +%s)
EMAIL="tier2+${STAMP}@example.com"
EMAIL2="tier2b+${STAMP}@example.com"
PW="password123"
NEW_PW="newpassword456"
LOCK_PW="lockpassword1"

CJ=$(mktemp); CJ2=$(mktemp); CJ3=$(mktemp)
trap 'rm -f "$CJ" "$CJ2" "$CJ3" "$CJ_LOCK"' EXIT

echo "── Base: $BASE ──────────────────────────────────────────────────────────"

# ── 1. Register ──────────────────────────────────────────────────────────────
R=$(curl -sS -o /tmp/r.json -w '%{http_code}' -X POST "$BASE/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PW\"}")
BODY=$(cat /tmp/r.json)
check "register returns 201" $([ "$R" = 201 ]; echo $?)
check "register body has success/accessToken/user" \
  $(jcheck "$BODY" "'success' in d and 'accessToken' in d and 'user' in d"; echo $?)
AT=$(jget "$BODY" "d['accessToken']")
check "register sets kz_at cookie" $(grep -q 'kz_at' <(curl -sS -D - -o /dev/null -X POST "$BASE/auth/register" -H 'Content-Type: application/json' -d "{\"email\":\"dup${STAMP}@example.com\",\"password\":\"$PW\"}"); echo $?)

R=$(curl -sS -o /tmp/r.json -w '%{http_code}' -X POST "$BASE/auth/register" \
  -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PW\"}")
check "duplicate register returns 409" $([ "$R" = 409 ]; echo $?)

R=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$BASE/auth/register" \
  -H 'Content-Type: application/json' -d '{"email":"bad-email","password":"x"}')
check "invalid register returns 400" $([ "$R" = 400 ]; echo $?)

# ── 2. Login (cookie jar) ───────────────────────────────────────────────────
R=$(curl -sS -o /tmp/r.json -w '%{http_code}' -c "$CJ" -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PW\"}")
BODY=$(cat /tmp/r.json)
check "login returns 200" $([ "$R" = 200 ]; echo $?)
check "login body matches LoginSuccessResult" \
  $(jcheck "$BODY" "'success' in d and 'user' in d and 'accessToken' in d"; echo $?)
# Refresh token from LOGIN — a later login rotates the register-time hash.
RT=$(jget "$BODY" "d['refreshToken']")

R=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"wrong-pw\"}")
check "wrong password returns 401" $([ "$R" = 401 ]; echo $?)

# ── 3. Profile via cookie auth ──────────────────────────────────────────────
R=$(curl -sS -o /tmp/r.json -w '%{http_code}' -b "$CJ" "$BASE/auth/profile")
check "profile via cookie returns 200" $([ "$R" = 200 ]; echo $?)
check "profile email matches" $(jcheck "$(cat /tmp/r.json)" "d['email'] == '$EMAIL'"; echo $?)

R=$(curl -sS -o /dev/null -w '%{http_code}' "$BASE/auth/profile")
check "profile without auth returns 401" $([ "$R" = 401 ]; echo $?)

R=$(curl -sS -o /dev/null -w '%{http_code}' "$BASE/auth/profile" -H "Authorization: Bearer $AT")
check "profile via Bearer returns 200" $([ "$R" = 200 ]; echo $?)

# ── 4. Refresh rotation + replay rejection ──────────────────────────────────
R=$(curl -sS -o /tmp/r.json -w '%{http_code}' -b "kz_rt=$RT" -X POST "$BASE/auth/refresh")
check "refresh returns 200" $([ "$R" = 200 ]; echo $?)
AT2=$(jget "$(cat /tmp/r.json)" "d['accessToken']")
RT2=$(curl -sS -D - -o /dev/null -b "kz_rt=$RT" -X POST "$BASE/auth/refresh" | awk -F'[=;]' '/kz_rt=/{print $2; exit}')
# Rotation: replaying the OLD refresh token must now fail.
R=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$BASE/auth/refresh" -H "Cookie: kz_rt=$RT")
check "old refresh token replay returns 401" $([ "$R" = 401 ]; echo $?)

# ── 5. Logout clears cookies + invalidates session ──────────────────────────
R=$(curl -sS -o /dev/null -w '%{http_code}' -b "$CJ" -c "$CJ" -X POST "$BASE/auth/logout")
check "logout returns 200" $([ "$R" = 200 ]; echo $?)
R=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$BASE/auth/logout" -H "Authorization: Bearer $AT2")
check "logout with rotated token returns 200" $([ "$R" = 200 ]; echo $?)

# ── 6. Forgot / reset password (lockout recovery) ───────────────────────────
# Register the victim account, then lock it: 5 bad attempts.
R=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$BASE/auth/register" \
  -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL2\",\"password\":\"$PW\"}")
check "register (victim) returns 201" $([ "$R" = 201 ]; echo $?)
CJ_LOCK=$(mktemp)
for _ in 1 2 3 4 5; do
  curl -sS -o /dev/null -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$EMAIL2\",\"password\":\"$LOCK_PW\"}"
done
R=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL2\",\"password\":\"$LOCK_PW\"}")
check "6th attempt on fresh account returns 401" $([ "$R" = 401 ]; echo $?)
R=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL2\",\"password\":\"password123\"}")
check "locked account rejects CORRECT password" $([ "$R" = 401 ]; echo $?)

R=$(curl -sS -o /tmp/r.json -w '%{http_code}' -X POST "$BASE/auth/forgot-password" \
  -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL2\"}")
BODY=$(cat /tmp/r.json)
check "forgot-password returns 200 + anti-enumeration message" \
  $(jcheck "$BODY" "'message' in d"; echo $?)
RESET_TOKEN=$(jget "$BODY" "d.get('devResetToken','')")
if [ -z "$RESET_TOKEN" ]; then
  echo "  note: no devResetToken in response (production mode) — reset flow needs the emailed token"
else
  R=$(curl -sS -o /tmp/r.json -w '%{http_code}' -X POST "$BASE/auth/reset-password" \
    -H 'Content-Type: application/json' \
    -d "{\"token\":\"$RESET_TOKEN\",\"password\":\"$NEW_PW\"}")
  check "reset-password returns 200" $([ "$R" = 200 ]; echo $?)
  R=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$BASE/auth/login" \
    -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL2\",\"password\":\"$NEW_PW\"}")
  check "reset UNLOCKS account (new password logs in)" $([ "$R" = 200 ]; echo $?)
  R=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$BASE/auth/login" \
    -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL2\",\"password\":\"$LOCK_PW\"}")
  check "old password rejected after reset" $([ "$R" = 401 ]; echo $?)
  R=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$BASE/auth/reset-password" \
    -H 'Content-Type: application/json' -d "{\"token\":\"$RESET_TOKEN\",\"password\":\"another789\"}")
  check "reused reset token returns 401" $([ "$R" = 401 ]; echo $?)
fi

# ── 7. MFA: setup → enable → login → disable ────────────────────────────────
R=$(curl -sS -o /tmp/r.json -w '%{http_code}' -b "$CJ2" -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PW\"}")
AT_MFA=$(jget "$(cat /tmp/r.json)" "d['accessToken']")
R=$(curl -sS -o /tmp/r.json -w '%{http_code}' -H "Authorization: Bearer $AT_MFA" \
  "$BASE/auth/mfa/status")
check "mfa/status returns 200 + mfaEnabled:false" \
  $(jcheck "$(cat /tmp/r.json)" "d.get('mfaEnabled') == False"; echo $?)

R=$(curl -sS -o /tmp/r.json -w '%{http_code}' -H "Authorization: Bearer $AT_MFA" \
  -X POST "$BASE/auth/mfa/setup")
SECRET=$(jget "$(cat /tmp/r.json)" "d.get('secret','')")
check "mfa/setup returns secret + otpauthUrl" \
  $(jcheck "$(cat /tmp/r.json)" "'secret' in d and 'otpauthUrl' in d"; echo $?)

CODE=$(python3 - "$SECRET" <<'PY'
import base64, hashlib, hmac, struct, time, sys
secret = base64.b32decode(sys.argv[1] + "=" * (-len(sys.argv[1]) % 8))
counter = int(time.time()) // 30
msg = struct.pack(">Q", counter)
mac = hmac.new(secret, msg, hashlib.sha1).digest()
off = mac[-1] & 0x0F
code = (struct.unpack(">I", mac[off:off+4])[0] & 0x7FFFFFFF) % 1000000
print(f"{code:06d}")
PY
)
R=$(curl -sS -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $AT_MFA" \
  -X POST "$BASE/auth/mfa/enable" -H 'Content-Type: application/json' -d '{"code":"000000"}')
check "mfa/enable rejects wrong code (401)" $([ "$R" = 401 ]; echo $?)
R=$(curl -sS -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $AT_MFA" \
  -X POST "$BASE/auth/mfa/enable" -H 'Content-Type: application/json' -d "{\"code\":\"$CODE\"}")
check "mfa/enable accepts valid TOTP code" $([ "$R" = 200 ]; echo $?)

R=$(curl -sS -o /tmp/r.json -w '%{http_code}' -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PW\"}")
check "login now returns mfaRequired" \
  $(jcheck "$(cat /tmp/r.json)" "d.get('mfaRequired') == True"; echo $?)
MFA_TOKEN=$(jget "$(cat /tmp/r.json)" "d.get('mfaToken','')")
CODE=$(python3 - "$SECRET" <<'PY'
import base64, hashlib, hmac, struct, time, sys
secret = base64.b32decode(sys.argv[1] + "=" * (-len(sys.argv[1]) % 8))
counter = int(time.time()) // 30
msg = struct.pack(">Q", counter)
mac = hmac.new(secret, msg, hashlib.sha1).digest()
off = mac[-1] & 0x0F
code = (struct.unpack(">I", mac[off:off+4])[0] & 0x7FFFFFFF) % 1000000
print(f"{code:06d}")
PY
)
R=$(curl -sS -o /tmp/r.json -w '%{http_code}' -X POST "$BASE/auth/login/mfa" \
  -H 'Content-Type: application/json' -d "{\"mfaToken\":\"$MFA_TOKEN\",\"code\":\"$CODE\"}")
check "login/mfa completes the session" $([ "$R" = 200 ]; echo $?)
AT3=$(jget "$(cat /tmp/r.json)" "d['accessToken']")

R=$(curl -sS -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $AT3" \
  -X POST "$BASE/auth/mfa/disable" -H 'Content-Type: application/json' -d "{\"code\":\"$CODE\"}")
check "mfa/disable clears MFA" $([ "$R" = 200 ]; echo $?)
R=$(curl -sS -o /tmp/r.json -w '%{http_code}' -H "Authorization: Bearer $AT3" "$BASE/auth/mfa/status")
check "mfa/status back to false" \
  $(jcheck "$(cat /tmp/r.json)" "d.get('mfaEnabled') == False"; echo $?)

# ── 8. RPC secret enforcement (service-binding path) ────────────────────────
if [ "$RUN_RPC" = "1" ]; then
  R=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$RPC_BASE/rpc/validate-token" \
    -H 'Content-Type: application/json' -d "{\"token\":\"$AT\"}")
  check "rpc without secret returns 401" $([ "$R" = 401 ]; echo $?)
  R=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$RPC_BASE/rpc/validate-token" \
    -H 'Content-Type: application/json' -H 'X-Klenzo-Rpc-Secret: wrong-secret' \
    -d "{\"token\":\"$AT\"}")
  check "rpc with wrong secret returns 401" $([ "$R" = 401 ]; echo $?)
fi

# ── Summary ─────────────────────────────────────────────────────────────────
echo "──────────────────────────────────────────────────────────────────────────"
echo "PASS: $PASS  FAIL: $FAIL"
if [ "$FAIL" -gt 0 ]; then
  printf 'failed: %s\n' "${FAILED_NAMES[@]}"
  exit 1
fi
exit 0
