# LLASA Practice Management

LLASA Practice Management is a Vite, React, TypeScript, shadcn-ui, and Tailwind CSS application for HR and labour law practice workflows.

## Development

Install dependencies:

```sh
npm install
```

Start the local development server:

```sh
npm run dev
```

## Build

Create a production build:

```sh
npm run build
```

Preview the production build locally:

```sh
npm run preview
```

## Deployment

Create the production build:

```sh
npm run build
```

Deploy the contents of the generated `dist` folder to Absolute Hosting.

The build includes `dist/.htaccess`, copied from `public/.htaccess`. Make sure hidden files are included during upload so the app has the correct single-page-app routing and no-cache rules for `index.html`, `sw.js`, and `manifest.webmanifest`.
