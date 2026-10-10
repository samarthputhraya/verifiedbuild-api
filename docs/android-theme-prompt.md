# Android theme: make the app look like the web app

**For Ayush.** The student web app (https://verifiedbuild-api-215071922486.asia-south1.run.app/app/) is now built on Google's Material 3 Expressive. The Android app should look like the same product. Your app already keeps its colours in one file (`ui/theme/Tokens.kt`), so this is mostly a value swap.

**When:** only after the app talks to our API (stages 1 to 3 of `docs/ai-studio-android-prompts.md`). Connecting to the API matters more than looks. If it isn't done by 23:00, skip this and help with the pitch, video and volunteers instead; the demo can run on the web app.

**Source of truth:** `design/tokens.json` in the API repo. Every value below is copied from it.

Paste the prompt below into AI Studio as one message. Then compare each screen with the web app on your phone.

---

## Prompt for AI Studio (copy everything inside the box)

```
Restyle the app to match our web app exactly. This is a visual change only: do not change any API calls, data models, navigation or behaviour. Keep all existing screens.

1. App name and icon
- App name everywhere: "VerifiedBuild" (strings.xml app_name, any top bar titles that say NexusIntern).
- Launcher icon: a 9-sided rounded "cookie" shape in #2946E5 with a white check mark. Use this image as the source: https://verifiedbuild-api-215071922486.asia-south1.run.app/icons/maskable-512.png (adaptive icon foreground; background #F9F5FF).

2. Fonts
- Download Google Sans Flex (SIL Open Font License) from https://github.com/google/fonts/raw/main/ofl/googlesansflex/GoogleSansFlex%5BROND,opsz,slnt,wdth,wght%5D.ttf and save it as res/font/google_sans_flex.ttf.
- Download Google Sans Code from https://github.com/google/fonts/raw/main/ofl/googlesanscode/GoogleSansCode%5Bwght%5D.ttf and save it as res/font/google_sans_code.ttf.
- Remove res/font/inter.ttf and every use of InterFontFamily.
- In Type.kt define:
  val BrandFont = FontFamily(
    Font(R.font.google_sans_flex, FontWeight.Normal, variationSettings = FontVariation.Settings(FontVariation.weight(400))),
    Font(R.font.google_sans_flex, FontWeight.Medium, variationSettings = FontVariation.Settings(FontVariation.weight(500))),
    Font(R.font.google_sans_flex, FontWeight.SemiBold, variationSettings = FontVariation.Settings(FontVariation.weight(600))),
    Font(R.font.google_sans_flex, FontWeight.Bold, variationSettings = FontVariation.Settings(FontVariation.weight(700))))
  val CodeFont = FontFamily(Font(R.font.google_sans_code, FontWeight.Normal))
- Typography (size / line height, all sp, all BrandFont):
  displayLarge 57/64 Medium, displayMedium 45/52 Medium, displaySmall 36/44 Medium,
  headlineLarge 32/40 Medium, headlineMedium 28/36 Medium, headlineSmall 24/32 Medium,
  titleLarge 22/28 Medium, titleMedium 16/24 SemiBold, titleSmall 14/20 SemiBold,
  bodyLarge 16/24 Normal, bodyMedium 14/20 Normal, bodySmall 12/16 Normal,
  labelLarge 14/20 SemiBold, labelMedium 12/16 SemiBold, labelSmall 11/16 SemiBold.
- Code snippets use CodeFont at 13sp, line height 22sp.

3. Colours: Material 3 colour scheme (Theme.kt)
Use MaterialTheme with these exact colour schemes, light and dark, following the system setting. Turn off dynamic colour (no dynamicLightColorScheme / dynamicDarkColorScheme), so every phone shows our colours.

Light:
primary #2946E5, onPrimary #F3F1FF, primaryContainer #8999FF, onPrimaryContainer #001470,
secondary #554DB5, onSecondary #F5F1FF, secondaryContainer #D1CCFF, onSecondaryContainer #4037A0,
tertiary #93387F, onTertiary #FFEEF6, tertiaryContainer #F98FDC, onTertiaryContainer #600653,
error #B41340, onError #FFEFEF, errorContainer #F74B6D, onErrorContainer #510017,
background #F9F5FF, onBackground #2D2A51, surface #F9F5FF, onSurface #2D2A51,
surfaceVariant #DDD9FF, onSurfaceVariant #5A5781, outline #75729E, outlineVariant #ACA8D7,
surfaceContainerLowest #FFFFFF, surfaceContainerLow #F3EEFF, surfaceContainer #EAE5FF,
surfaceContainerHigh #E3DFFF, surfaceContainerHighest #DDD9FF, surfaceDim #D4CFFF, surfaceBright #F9F5FF,
inverseSurface #0B082F, inverseOnSurface #E7E2FF, inversePrimary #9BA8FF, scrim #000000.

Dark:
primary #9BA8FF, onPrimary #001C8E, primaryContainer #8999FF, onPrimaryContainer #001470,
secondary #9891FE, onSecondary #170074, secondaryContainer #40369F, onSecondaryContainer #D0CBFF,
tertiary #FFA4E4, onTertiary #6D155D, tertiaryContainer #F98FDC, onTertiaryContainer #600653,
error #FF6E84, onError #490013, errorContainer #A70138, onErrorContainer #FFB2B9,
background #0B082F, onBackground #E7E2FF, surface #0B082F, onSurface #E7E2FF,
surfaceVariant #221E55, onSurfaceVariant #AAA6D5, outline #74719C, outlineVariant #46436C,
surfaceContainerLowest #06041F, surfaceContainerLow #100C37, surfaceContainer #171241,
surfaceContainerHigh #1C184B, surfaceContainerHighest #221E55, surfaceDim #0B082F, surfaceBright #28245F,
inverseSurface #FCF8FF, inverseOnSurface #2D2A51, inversePrimary #2E4BE8, scrim #000000.

Skill levels (chips and score tiles) use these pairs, background then text:
- strong: light #8AF8C2 / #002113, dark #005236 / #8AF8C2
- partial: light #FFDEAB / #271900, dark #5F4100 / #FFDEAB
- not verified: errorContainer / onErrorContainer
- not shown: surfaceContainerHighest / onSurfaceVariant

4. Point the existing tokens at the scheme (Tokens.kt)
Keep the NexusTokens names so nothing else breaks, but make every colour read from MaterialTheme.colorScheme (make them @Composable getters), mapped like this:
Background -> background, Surface -> surfaceContainerLow, SurfaceSecondary -> surfaceContainer,
Foreground -> onSurface, ForegroundSecondary -> onSurfaceVariant, ForegroundTertiary -> outline,
Border -> outlineVariant, BorderStrong -> outline, Accent -> primary, AccentHover -> onPrimaryContainer,
AccentSubtle -> secondaryContainer, OnAccent -> onPrimary,
Success* -> the "strong" pair above, Warning* -> the "partial" pair, Error* -> errorContainer / onErrorContainer (border: error),
Info* -> secondaryContainer / onSecondaryContainer (border: secondary).
Corner radii: sm 8dp, md 12dp, lg 16dp, surface 28dp, pill 100dp.

5. Shapes and components
- MaterialTheme shapes: extraSmall 4dp, small 8dp, medium 12dp, large 16dp, extraLarge 28dp.
- Buttons are fully rounded (pill). Primary actions: filled Button, 56dp tall on main calls to action ("Pick a repo", "Start question 1", "Send answer", "See my report"). Secondary: FilledTonalButton. Tertiary: TextButton.
- Cards: 16dp corners on list cards, 28dp on the big top card of a screen. Card colour surfaceContainerLow, no shadows except the floating mic button.
- Text fields: OutlinedTextField with floating labels; show errors with isError and supportingText under the field (never in a box at the bottom of the screen).
- Chips: FilterChip for interests and skills (check mark when selected, selected colour secondaryContainer).
- Bottom navigation: NavigationBar with 4 items: Home (home), Verify (code), Internships (work), Report (verified). Selected item uses the pill indicator in secondaryContainer. Hide it during the viva.
- Dialogs: AlertDialog with an icon on top and a centred title.
- Snackbars for "Answer saved", "Applied to Promtal", errors that need no action.
- Delete Floating3DBackground from every screen. Screens sit on the plain background colour.

6. Signature pieces (these make it ours, match the web app)
- Viva screen: the code snippet sits in a dark "editor" card on both themes: background #120F38 (dark theme #06041F), header strip #1A1647 with the file name and "lines a-b" in #8F8BBD, line numbers #8F8BBD, code text #E7E2FF, CodeFont 13sp, horizontal scroll.
- Mic button: 96dp circle in primary with a filled mic icon. While recording it morphs (animate the corner radius) to a 28dp rounded square in error, shows a stop icon, and a circular progress ring 136dp around it shows the time left of the 90 seconds.
- Under the mic, 28 thin bars (4dp wide) whose heights follow the live microphone loudness while recording.
- Overall score: a 10-point soft "burst" star shape filled with primary, the number in displaySmall onPrimary and "out of 100" under it.
- Skill tiles on the report: a grid of 6 tiles (2 per row on phones). Each tile has a 72dp shaped icon (backend: 9-sided cookie, frontend: 4-leaf clover, data: 8-point sunny, AI/ML: 10-point burst, DevOps: 6-sided cookie, security: 12-sided cookie) coloured by its level pair above, then the skill name, the score, and a level chip.
- Match cards: a circular progress ring with the match % in the centre, title, company, and the "why" sentence from the API in onSurfaceVariant.

7. Check
Build, then open each screen next to the web app on the same phone: sign-up, home, pick a repo, reading the repo, what we found, a viva question, done, report, internships. Colours, fonts and corner shapes should match. Report anything you couldn't match instead of guessing.
```

---

## After the prompt

1. Ask AI Studio to fix anything that doesn't compile, without changing the colours or fonts.
2. Push from AI Studio so `verifiedbuild-app` has it.
3. Tell SAM which screens still look different, with a screenshot of each.
