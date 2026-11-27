# Heading Tidy: Fix Headings in Bulk

A free SiYuan plugin for the document you have open. It finds headings that are really body text, which is common after importing a scanned book or PDF through OCR, and converts them back to paragraphs in one click.

## What it does
- Flags headings that look like sentences: they end with punctuation or are longer than a limit you set (default 40 characters).
- Keeps chapter titles. Words you list (default: `章, 节, 题, Chapter, Section, Part`) protect a heading when they appear near its start. You can also use `/regex/`.
- Review the ticks, then **Convert ticked to paragraphs**. Text, inline formatting and block IDs stay the same.
- **Also close level gaps** fixes jumps such as h1 followed by h4, after the conversion.
- **Promote all / Demote all** shifts every heading by one level (refuses if something would go past h1 or h6).

## How to use
Open a document, click the Heading Tidy icon in the top bar (or run the command "Open Heading Tidy"), check the suggested rows, press a button and confirm.

SiYuan's document history (right click the document, History) keeps earlier versions of your notes; check it before large changes.

## Notes
- Works on one document at a time.
- Illustrations use sample data. Nothing is sent anywhere; everything runs against your local SiYuan.
- Tested against a real SiYuan 3.8.12 kernel (headless) for reading headings, converting to paragraphs, level fixing and shifting. The dialog itself was not exercised in the desktop app.

## Why
Requests this addresses: converting headings to paragraphs in bulk with exceptions for words like chapter markers (raised on the Floating TOC plugin, issue #27, where the maintainer pointed to batch block editing), and bulk level fixes for imported documents.

MIT license.
