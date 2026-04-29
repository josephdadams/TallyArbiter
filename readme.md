# Tally Arbiter

![GitHub release (latest by date)](https://img.shields.io/github/v/release/josephdadams/TallyArbiter)
![License](https://img.shields.io/github/license/josephdadams/TallyArbiter)
![Desktop Build](https://img.shields.io/github/actions/workflow/status/josephdadams/TallyArbiter/build-desktop.yml?branch=master&label=Desktop%20Builds)
![Listener Clients Build](https://img.shields.io/github/actions/workflow/status/josephdadams/TallyArbiter/build-listener-clients.yaml?branch=master&label=Listener%20Client%20Builds)
![Publish to NPM](https://github.com/josephdadams/TallyArbiter/actions/workflows/npm.yml/badge.svg)
![Docker Pulls](https://img.shields.io/docker/pulls/josephdadams/tallyarbiter)

> A camera tally lights system capable of listening to and aggregating tally data from multiple sources and video switchers, then arbitrating Preview and Program states for connected devices.

Tally Arbiter supports a wide range of switchers, protocols, and tally output methods. It is designed for flexibility, reliability, and ease of integration in live production environments.

---

## 📦 Installation

### Desktop App (Recommended)

Download installers for macOS, Windows, and Linux:

👉 https://josephdadams.github.io/TallyArbiter/docs/installation/desktop-app

### CLI / Server

```bash
npm install -g tallyarbiter
tallyarbiter
```

### Docker

Use the included docker-compose.yml file or Dockerfile.

Run with:

```bash
docker compose up -d
```

---

## 📚 Documentation

Full documentation including setup guides, supported devices, and configuration:

👉 https://josephdadams.github.io/TallyArbiter/docs/intro

---

## 🧑‍💻 Development

### Prerequisites

- Node.js >= 18.13
- npm >= 7

### Setup

```bash
git clone https://github.com/josephdadams/TallyArbiter
cd TallyArbiter
npm install
npm start
```

---

## 🎨 UI Development

The UI is located in the `UI` folder and built with Angular.

```bash
cd UI
npm install
npm start
```

Then visit:

http://localhost:4200

The backend must be running on port 4455.

### Building UI for production

From project root:

```bash
npm run build-ui
```

This automatically builds the UI and outputs to `ui-dist/`.

---

## 🖥 Desktop App

Built with Electron.

Run locally:

```bash
npm run desktop
```

Build installers:

```bash
npm run build-desktop
```

---

## 🚀 Releasing

1. Update version in `package.json` and `package-lock.json`
2. Create and push tag:

```bash
git tag vX.Y.Z
git push --tags
```

3. GitHub Actions will build releases automatically as a draft
4. Publish release notes from GitHub Releases page

---

## 🤝 Contributing

Contributions are welcome!

- Fork the repo
- Create feature branch
- Submit pull request

Issues and feature requests:

👉 https://github.com/josephdadams/TallyArbiter/issues

---

## 📄 License

MIT License

Written and maintained by Joseph Adams.

Not affiliated with any other company or product.

---

### ❤️ More Projects

Visit https://techministry.blog to explore more tools and projects.
