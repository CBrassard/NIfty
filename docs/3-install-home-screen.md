# Step 3 – Install the NIfty home screen on your TV

This puts NIfty on the TV: a plain, ad-free home screen that shows a clock and
only the apps you choose. It's a normal Tizen app that you sideload in Samsung's
Developer Mode. **Your TV's firmware is not changed.** You can delete NIfty
like any other app, and a factory reset removes it completely.

Plan on about an hour the first time. Most of that is installing Samsung's tools.

You need:
- A Windows, macOS or Linux computer **on the same home network** as the TV.
- A free **Samsung account** (the same kind you use on the TV).
- The TV remote.

---

## 3.1 Install Samsung's developer tools on your computer

1. Download **Tizen Studio** (the "CLI" installer is enough):
   https://developer.tizen.org/development/tizen-studio/download
2. Run it, then open **Package Manager** (`~/tizen-studio/package-manager/`).
3. On the **Extension SDK** tab, install:
   - **Samsung Certificate Extension**
   - **TV Extensions** (the newest version listed)
4. Remember where Tizen Studio was installed (default `~/tizen-studio`, or
   `C:\tizen-studio` on Windows).

## 3.2 Find your TV's IP address and Device ID

On the TV:
- **IP address**: Settings → General → Network → Network Status → **IP Settings**.
- **DUID** (Unique Device ID, needed for the certificate): Settings → Support →
  **Contact Samsung** (on some models: **About This TV**) → *Unique Device ID*.
  Write down the long code. If you can't find it, skip it: Certificate Manager
  can read it from the TV once it's connected (see the tip in 3.4).

Also give the TV a **fixed IP address** in your router (a "DHCP reservation"),
so the address doesn't change later.

## 3.3 Turn on Developer Mode on the TV

1. Find your **computer's** IP address (e.g. Windows: `ipconfig`;
   Mac: System Settings → Network).
2. On the TV press **Home**, go to **Apps**.
3. On the Apps screen, type **1 2 3 4 5** on the remote. If your remote has no
   number keys, press the **123** / **⋯** button to bring up the on-screen
   number pad.
4. A *Developer Mode* box appears. Switch it **On**, type your **computer's IP**
   as *Host PC IP*, and press OK.
5. Turn the TV off and on again as it asks. If Developer Mode doesn't stay on,
   **unplug the TV from the wall for 10 seconds** and try again.

When it's working, the Apps screen shows **"Developer Mode"** at the top.

## 3.4 Make your signing certificate

Samsung TVs only install apps signed with a certificate tied to *your* TV.

1. Open Tizen Studio → **Tools → Certificate Manager**.
2. Click **+**, choose **Samsung**, then **TV**.
3. Give the profile a name, e.g. `MySamsungTV`. You'll put this name in the config file later.
4. **Author certificate**: create a new one, set a password, and
   **back up the `.p12` file it creates**. You need the same author
   certificate for every future update of the app.
5. Sign in with your Samsung account when asked.
6. **Distributor certificate**: choose *Privilege: Public*, and add your TV's
   **DUID** from step 3.2.

> Tip: if you already connected the TV with `sdb` (step 3.6), Certificate
> Manager fills in the DUID automatically.

## 3.5 Configure this project

In a terminal, inside this repository:

```bash
mkdir -p .local
cp tv.env.example .local/tv.env
```

Edit `.local/tv.env`:

- `TV_IP`: the TV's IP address.
- `CERT_PROFILE`: the certificate profile name from 3.4.
- `TIZEN_PACKAGE_ID`: **make up** exactly 10 letters/digits, e.g. `Ab3dE6gH9j`.
- `TIZEN_APP_ID`: the same 10 characters, then `.NIfty`, e.g. `Ab3dE6gH9j.NIfty`.
- `TIZEN_STUDIO`: where Tizen Studio was installed.

Don't change the two IDs after the first install.

## 3.6 Build and install

macOS / Linux (on Windows, use **Git Bash** or **WSL**):

```bash
./scripts/build.sh      # makes dist/NIfty.wgt, signed with your certificate
./scripts/install.sh    # connects to the TV, installs, and opens NIfty
```

NIfty now appears in the TV's **Apps** list. It opens on its own after the install.

### If something goes wrong

| Message | Fix |
|---|---|
| `failed to connect` / TV not in `sdb devices` | Developer Mode is off, or *Host PC IP* is wrong. Redo 3.3, then unplug the TV for 10 seconds. Computer and TV must be on the same network. VPNs get in the way, so turn them off. |
| `Signature ... invalid` / `install failed (-12)` | The certificate doesn't include this TV's DUID, or you made a *Tizen* profile, not a *Samsung TV* one. Redo 3.4. |
| `-11` / `Author certificate mismatch` | An older NIfty was signed with a different author certificate. Delete NIfty from the TV first. |
| Build: `profile not found` | `CERT_PROFILE` doesn't exactly match the name in Certificate Manager. |
| Installs but apps are missing | Press **Back**, then reopen NIfty. It reloads the app list each time it's opened. |

## 3.7 Make NIfty your "home"

Samsung doesn't officially let you replace the Home screen. What you can do:

1. **Pin NIfty** to the start of the Samsung home bar: Home → find NIfty →
   press Down (or press and hold OK) → **Move**, and put it first.
2. Turn on **Autorun Last App** (see [Step 1](1-declutter-settings.md)).
   The TV then turns on into whatever app was open last. Leave NIfty open when
   you switch the TV off, and it'll be the first thing you see.
3. Turn off **Autorun Smart Hub** so Samsung's bar doesn't pop up over it.

Pressing **Home** on the remote still opens Samsung's bar. CleanFrame has an
experimental way to swap the actual Home screen, but it uses undocumented
internals, only works on certain Frame TV firmware, and can break with updates.
This repo leaves it out on purpose.

## Using NIfty

- **Arrows** move, **OK** opens an app.
- Go down to **Arrange** and press OK to rearrange: press OK on an app, choose
  **Move** (then use the arrows, and OK to drop it) or **Hide from home**.
  Hidden apps show up dimmed in Arrange mode so you can bring them back.
  Samsung TV Plus, Gaming Hub and a few other promo apps start hidden.
- **Back** leaves Arrange mode.

## Developer Mode notes

- Developer Mode lets *your computer's IP* install apps on the TV. Leaving it
  on is fine on a home network. To turn it off, repeat 3.3 and switch it Off.
  Apps you already installed normally keep working.
- Samsung's developer certificates expire after a while (usually a few years).
  When that happens, rebuild and reinstall with a renewed certificate. Your
  layout settings are kept as long as the IDs stay the same.
- A firmware update or factory reset may remove NIfty. Run
  `./scripts/install.sh` again.
