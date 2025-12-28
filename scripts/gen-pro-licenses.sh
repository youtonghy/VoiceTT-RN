#!/usr/bin/env bash
set -euo pipefail

KEY_PATH="./pro.private.pem"
COUNT=1
DAYS=""
EXP_DATE=""
LIFETIME=false
DEVICE_UID=""
OUT_FILE=""

usage() {
  cat <<'USAGE'
Usage:
  gen-pro-licenses.sh --days <7|30|90|365> [--count N] [--out FILE] [--device UID] [--key PATH]
  gen-pro-licenses.sh --exp <YYYY-MM-DD|YYYY-MM-DDTHH:MM:SSZ> [--count N] [--out FILE] [--device UID] [--key PATH]
  gen-pro-licenses.sh --lifetime [--count N] [--out FILE] [--device UID] [--key PATH]

Notes:
  - Requires OpenSSL with Ed25519 support.
  - --exp will be converted to planDays; planDays must be 7/30/90/365.
  - --lifetime will emit exp=0 and isLifetime=true.
USAGE
}

error() {
  echo "Error: $*" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --days)
      DAYS="${2:-}"
      shift 2
      ;;
    --exp)
      EXP_DATE="${2:-}"
      shift 2
      ;;
    --lifetime)
      LIFETIME=true
      shift 1
      ;;
    --count)
      COUNT="${2:-}"
      shift 2
      ;;
    --device)
      DEVICE_UID="${2:-}"
      shift 2
      ;;
    --out)
      OUT_FILE="${2:-}"
      shift 2
      ;;
    --key)
      KEY_PATH="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      error "Unknown option: $1"
      ;;
  esac
done

if [[ "$LIFETIME" == false && -z "$DAYS" && -z "$EXP_DATE" ]]; then
  usage
  error "Either --days or --exp is required."
fi

if [[ "$LIFETIME" == true && ( -n "$DAYS" || -n "$EXP_DATE" ) ]]; then
  usage
  error "Do not combine --lifetime with --days or --exp."
fi

if [[ -n "$DAYS" && -n "$EXP_DATE" ]]; then
  usage
  error "Only one of --days or --exp can be used."
fi

if [[ ! -f "$KEY_PATH" ]]; then
  error "Private key not found: $KEY_PATH"
fi

now="$(date -u +%s)"

if [[ "$LIFETIME" == true ]]; then
  plan_days=0
  exp=0
else
  if [[ -n "$DAYS" ]]; then
  plan_days="$DAYS"
  exp="$((now + plan_days * 86400))"
  else
    if ! exp="$(date -u -d "$EXP_DATE" +%s 2>/dev/null)"; then
      error "Invalid --exp date format. Use YYYY-MM-DD or RFC3339."
    fi
    if [[ "$exp" -le "$now" ]]; then
      error "Expiration date must be in the future."
    fi
    diff="$((exp - now))"
    plan_days="$(((diff + 86399) / 86400))"
  fi

  case "$plan_days" in
    7|30|90|365) ;;
    *) error "planDays must be 7/30/90/365 (got $plan_days)." ;;
  esac
fi

bind_mode="first_use"
device_uid_json="null"
if [[ -n "$DEVICE_UID" ]]; then
  bind_mode="fixed"
  device_uid_json="\"$DEVICE_UID\""
fi

b64url() {
  base64 | tr '+/' '-_' | tr -d '=\n'
}

rand_b64url() {
  openssl rand -base64 "$1" | tr '+/' '-_' | tr -d '=\n'
}

sign_payload() {
  local payload_segment="$1"
  local tmp_file
  tmp_file="$(mktemp)"
  printf '%s' "$payload_segment" > "$tmp_file"
  openssl pkeyutl -sign -inkey "$KEY_PATH" -rawin -in "$tmp_file" | b64url
  rm -f "$tmp_file"
}

emit_code() {
  local lic_id nonce payload_json payload_segment signature
  lic_id="$(rand_b64url 8)"
  nonce="$(rand_b64url 12)"
  payload_json="{\"v\":1,\"product\":\"vtt-pro\",\"licId\":\"$lic_id\",\"planDays\":$plan_days,\"iat\":$now,\"exp\":$exp,\"nonce\":\"$nonce\",\"deviceUid\":$device_uid_json,\"bindMode\":\"$bind_mode\""
  if [[ "$LIFETIME" == true ]]; then
    payload_json+=",\"isLifetime\":true"
  fi
  payload_json+="}"
  payload_segment="$(printf '%s' "$payload_json" | b64url)"
  signature="$(sign_payload "$payload_segment")"
  printf 'LIC1.%s.%s\n' "$payload_segment" "$signature"
}

for ((i = 0; i < COUNT; i += 1)); do
  if [[ -n "$OUT_FILE" ]]; then
    emit_code >> "$OUT_FILE"
  else
    emit_code
  fi
done
