# Chrome Web Store listing

Copy these into the Developer Dashboard (https://chrome.google.com/webstore/devconsole).

## Store listing

**Name:** SleepyTube

**Summary** (from manifest, 132 chars max):
Make YouTube sleepy: slowed, muffled, reverb and echo sound, soft hush noise, a sleep timer and calming screen filters.

**Category:** Entertainment (or Accessibility)

**Description:**

SleepyTube turns any YouTube video into something you can fall asleep to.

SOUND
• One-click moods: Sleepy, Slowed + Reverb, Underwater, Next Room, Cathedral, Lo-fi Rain, Dreamy 8D
• Slow it down and lower the pitch
• Muffle the treble, like hearing it through a wall
• Reverb and echo for a big, dreamy room
• A soft "hush" of brown, pink, fan or rain noise underneath
• Sleep timer that gently fades the sound out, then pauses the video

SCREEN
• Black screen: the page goes dark while the sound keeps playing. Move the mouse for a "Show video" button
• Looks: Night (blue-light cut), Candle, Dark, Sepia, Black & White, Dreamy
• Fine-tune dim, blue cut, sepia, B&W and soften yourself
• Six calm colour themes: Moonlight, Pearl, Champagne, Sage, Rose and Iris

Works on youtube.com, YouTube Music and m.youtube.com. Settings are saved and shared by all YouTube tabs. One switch turns everything off instantly.

Private by design: everything runs on your device. No accounts, no tracking, no data leaves your browser.

Enjoying it? https://buymeacoffee.com/adityakandekar

**Images** (all in this folder):
- Icon: `../icons/icon128.png`
- Screenshots (1280×800): `screenshot-1-sound.png` … `screenshot-5-blackscreen.png`
- Small promo tile (440×280): `promo-small-440x280.png`
- Marquee (1400×560, optional): `promo-marquee-1400x560.png`
- Promo video (optional, YouTube link): upload `../demo/sleepytube-demo.mp4` to YouTube

## Privacy practices tab

**Single purpose:**
Changes how YouTube videos sound and look (slowed, muffled, reverb, background noise, sleep timer and screen filters) to help users relax and fall asleep.

**Permission justification:**
- `storage`: Saves the user's sound and screen settings so they persist and apply to every YouTube tab.
- Host access (content script on youtube.com, m.youtube.com, music.youtube.com): Needed to process the video's audio with the Web Audio API and apply screen filters on YouTube pages. It runs on no other sites.

**Remote code:** No, I am not using remote code.

**Data usage:** Collects no user data. Tick none of the data types, then certify the three disclosures (not sold, not used for unrelated purposes, not used for creditworthiness).

**Privacy policy URL:** Not required when no data is collected. If the form insists, use a page stating:
"SleepyTube does not collect, store or transmit any personal data. Settings are saved locally in your browser using chrome.storage."
