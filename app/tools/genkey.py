#!/usr/bin/env python3
"""
Ebanist — generatore di chiavi STORICHE  (EBP-XXXX-XXXX-XXXX)

    python3 genkey.py            una chiave
    python3 genkey.py 20         venti chiavi
    python3 genkey.py --check EBP-AB23-CD45-EF67

A cosa servono ancora, adesso che c'e Lemon Squeezy: agli amici del
mestiere, ai collaudatori, ai clienti di Domus Renov, e a chiunque paghi
per contanti o per bonifico. Sono offline, non scadono e non passano da
nessun negozio. Non sostituiscono l'abbonamento: lo affiancano.

Il checksum deve dare lo STESSO risultato di legacyCheck() in
app/ebanist-license.js. Se un giorno si tocca uno dei due, si tocca
l'altro nello stesso commit, e si rilancia `npm run test:license`.
"""

import secrets
import sys

ALPHA = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"   # 32 simboli, senza 0 1 I O
SALT = "ebanist-pro-2026"


def fnv1a32(s: str) -> int:
    """FNV-1a a 32 bit. La maschera a ogni giro e quello che tiene il
    risultato uguale a quello di Math.imul in JavaScript."""
    h = 0x811C9DC5
    for ch in s:
        h ^= ord(ch)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


def check(payload: str) -> str:
    h = fnv1a32(SALT + payload)
    return ALPHA[(h >> 5) & 31] + ALPHA[h & 31]


def make() -> str:
    payload = "".join(secrets.choice(ALPHA) for _ in range(10))
    body = payload + check(payload)
    return f"EBP-{body[0:4]}-{body[4:8]}-{body[8:12]}"


def valid(key: str) -> bool:
    k = key.strip().upper().replace(" ", "")
    parts = k.split("-")
    if len(parts) != 4 or parts[0] != "EBP":
        return False
    body = "".join(parts[1:])
    if len(body) != 12 or any(c not in ALPHA for c in body):
        return False
    return check(body[:10]) == body[10:]


if __name__ == "__main__":
    args = sys.argv[1:]
    if args and args[0] == "--check":
        if len(args) < 2:
            sys.exit("uso: genkey.py --check EBP-XXXX-XXXX-XXXX")
        print("valida" if valid(args[1]) else "NON valida")
    else:
        n = int(args[0]) if args and args[0].isdigit() else 1
        for _ in range(n):
            print(make())
