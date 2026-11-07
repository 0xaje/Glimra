# Glimra Linux Packaging & Desktop Installation Guide

**Target Release:** Glimra 1.0.0
**Packaging Engine:** Electron Builder v26.18.0
**Package Target:** Linux `AppImage` (x86_64)
**CI/CD Verification Run:** [GitHub Actions Run 42324191241](https://github.com/0xaje/Glimra/actions/runs/42324191241)
**Verification Status:**
- **CI Build & Packaging Pipeline:** **VERIFIED**
- **Linux AppImage Artifact Generation:** **VERIFIED**
- **Execution & Startup on Clean Linux Computer:** **NOT YET VERIFIED**

---

## 1. Packaging Architecture & Native Resource Audit

Glimra relies on the Presage SmartSpectra native C ABI and TensorFlow Lite models to perform low-latency on-device face and blink detection. In packaged desktop distributions, these resources must be accessible to Electron's runtime without requiring a developer environment or global dependencies.

### Bundled Native Resources (`extraResources/smartspectra`)
In [package.json](../package.json), the Linux distribution explicitly copies `@smartspectra/node-sdk-linux-x64` into the application's unpacked resource directory:

```json
"linux": {
  "target": "AppImage",
  "category": "Office",
  "extraResources": [
    {
      "from": "node_modules/@smartspectra/node-sdk-linux-${arch}/",
      "to": "smartspectra"
    }
  ]
}
```

### Verified Included Files in Package:
- `libsmartspectra_capi.so` (3.7 MB — C ABI dynamic entrypoint)
- `libsmartspectra.so` (54.8 MB — Core SmartSpectra engine)
- `graph/metrics_cpu_continuous_rest.binarypb` (Protobuf graph definition)
- `graph/models/face_detection_full_range.tflite`
- `graph/models/face_landmark.tflite`
- `graph/models/face_landmark_with_attention.tflite`
- Supporting media libraries (`libavcodec.so.60`, `libturbojpeg.so.0`, `libv4l2.so.0`, `libvulkan.so.1`, etc.)

### Runtime Resolution
In [src/main/main.ts](../src/main/main.ts), when `app.isPackaged` is true, the main process sets:
```ts
process.env.SMARTSPECTRA_CAPI_PATH = path.join(process.resourcesPath, 'smartspectra', 'libsmartspectra_capi.so');
```
Because `libsmartspectra_capi.so` has its RPATH configured as `$ORIGIN`, the dynamic linker automatically resolves `libsmartspectra.so` and accompanying shared libraries from the same directory at runtime without requiring `LD_LIBRARY_PATH` overrides.

### Security Audit
- `asar: true` is strictly enforced.
- Development files (`.env`, `.env.local`, test fixtures, scripts, raw audio assets) are excluded from the distribution archive.

---

## 2. Installation & Running on a Clean Linux Desktop

Follow these steps to test the packaged application on a supported Linux computer (Ubuntu 20.04+, Debian 11+, Fedora 36+, or Arch Linux):

### Step 1: Download the Verified Artifact
1. Open the verified GitHub Actions run:
   👉 **[GitHub Actions Run 42324191241](https://github.com/0xaje/Glimra/actions/runs/42324191241)**
2. Scroll to the **Artifacts** section at the bottom of the page.
3. Click **`glimra-linux-x64`** to download the zip file (`289,163,548 bytes`).

### Step 2: Extract the Package
Open a terminal in your download folder:
```bash
unzip glimra-linux-x64.zip
# This yields Glimra-1.0.0.AppImage
```

### Step 3: Grant Execute Permissions
```bash
chmod +x Glimra-1.0.0.AppImage
```

### Step 4: Ensure FUSE 2 is Available (Modern Distros)
Modern Linux distributions (such as Ubuntu 22.04+ or Debian 12+) ship with FUSE 3 by default. Standard AppImages require `libfuse2` to mount:
```bash
# Ubuntu / Debian / Linux Mint:
sudo apt update && sudo apt install -y libfuse2

# Fedora / RHEL:
sudo dnf install fuse-libs
```

*Alternative (No root permissions required):*
If you cannot install `libfuse2`, you can run the AppImage in self-extracted mode:
```bash
./Glimra-1.0.0.AppImage --appimage-extract-and-run
```

### Step 5: Launch Glimra
```bash
./Glimra-1.0.0.AppImage
```

---

## 3. Clean-Computer Acceptance Criteria Checklist

Before marking clean-system testing as **VERIFIED**, a tester must independently confirm:

- [ ] **Execution:** The AppImage launches without missing `.so` library errors.
- [ ] **Interface:** The presentation stage, starter deck, Presenter bar, and settings load cleanly.
- [ ] **SafeStorage:** Entering an API key stores it encrypted in the clean user's OS keyring.
- [ ] **Camera Access:** Connecting a webcam prompts for explicit presenter consent and accesses `/dev/video*`.
- [ ] **Resource Release:** Closing Glimra cleanly terminates all child processes and releases the webcam.

> [!NOTE]
> Until the above checklist has been executed on a standalone, non-development machine, the clean-computer startup milestone remains **NOT YET VERIFIED**.
