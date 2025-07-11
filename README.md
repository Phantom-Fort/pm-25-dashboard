# PM2.5 Dashboard

![Screenshot](./Screenshot%202025-07-10%20234833.png)

A web-based dashboard for visualizing PM2.5 concentration predictions and dispersion patterns, hosted on Vercel for global accessibility. Built with **Next.js**, **React**, **TypeScript**, **Leaflet**, **Recharts**, and **Tailwind CSS**, the application provides interactive maps and charts to analyze air quality data against regulatory standards, supporting environmental monitoring and analysis.

---

## 📚 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Accessing the Dashboard](#accessing-the-dashboard)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

---

## 🚀 Features

- **Interactive Map**: Displays PM2.5 dispersion points on a Leaflet map centered at coordinates `(6.5244, 3.3792)`.
- **Data Visualization**: Line, area, bar, and radar charts compare predicted PM2.5 concentrations (capped at 30 µg/m³) against regional standards.
- **Responsive Design**: Built with Tailwind CSS and Shadcn UI for a modern, responsive interface.
- **Dispersion Analysis**: Visualizes PM2.5 dispersion by distance and direction.
- **Regulatory Comparison**: Toggle between daily and annual PM2.5 limits across jurisdictions.

---

## 🧠 Tech Stack

- **Frontend**: Next.js, React, TypeScript
- **Map**: Leaflet (via `react-leaflet`)
- **Charts**: Recharts
- **Styling**: Tailwind CSS, Shadcn UI
- **Icons**: Lucide React
- **Deployment**: Vercel

---

## 🌐 Accessing the Dashboard

The PM2.5 Dashboard is deployed and accessible online via Vercel:

🔗 [**https://pm25-dashboard.vercel.app**](https://pm25-dashboard.vercel.app)\
*(Replace with your actual Vercel URL if not set)*

You can use the dashboard directly in a modern browser — no installation required.

---

## 💻 Local Development (Optional)

For developers who wish to run or contribute to the project locally:

### 🔁 Clone the Repository

```bash
git clone https://github.com/[Your-Username]/pm25-dashboard.git
cd pm25-dashboard
```

### 📆 Install Dependencies

Ensure **Node.js v18 or higher** is installed, then run:

```bash
npm install
```

### ⚙️ Set Up Environment Variables

Create a `.env.local` file in the root:

```env
# Example
NEXT_PUBLIC_API_URL=http://your-api-endpoint
```

### 🏁 Run the Dev Server

```bash
npm run dev
```

Visit `http://localhost:3000` in your browser.

### 🚀 Deploy to Vercel

1. Connect your GitHub repository via the [Vercel Dashboard](https://vercel.com/).
2. Set environment variables (if needed).
3. Use `npm run build` for production build configuration.
4. Deploy to generate a public URL.

---

## 🧪 Usage

- **Visit the Dashboard**: Open the deployed app.
- **Run Dispersion Analysis**: Click the "Dispersion Analysis" button.
- **Compare with Standards**: Switch between daily and annual limits using the dropdown.

### 📊 Available Charts

- **Line Chart**: Predicted PM2.5 vs. daily/annual limits.
- **Area Chart**: Predictions vs. regulatory caps.
- **Radar Chart**: Directional dispersion (N, NE, E, etc.).
- **Bar Chart**: PM2.5 by distance ranges (e.g., 0–1km, 1–2km, etc.).

---

## 🗂️ Project Structure

```
PM25-DASHBOARD/
├── .next/                      # Next.js build output
├── app/                        # Main app directory (Next.js 13+ App Router)
│   ├── components/
│   │   └── MapChartClient.tsx
│   ├── dashboard/
│   │   └── page.tsx
│   ├── login/
│   │   └── page.tsx
│   ├── profile/
│   │   └── page.tsx
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── backend/                    # Backend logic or API utilities
├── node_modules/
├── public/                     # Static assets
├── src/
│   └── app/
│       └── components/ui/
│           ├── AuthenticatedLayout.tsx
│           ├── button.tsx
│           ├── card.tsx
│           ├── chart.tsx
│           ├── checkbox.tsx
│           ├── dialog.tsx
│           ├── dropdown-menu.tsx
│           ├── FullScreenLoader.tsx
│           ├── input.tsx
│           ├── label.tsx
│           ├── PageWrapper.tsx
│           ├── select.tsx
│           ├── sonner.tsx
│           ├── table.tsx
│           ├── tabs.tsx
│           └── tooltip.tsx
├── lib/                        # Shared utility functions
├── styles/                     # Additional CSS
├── .env.local
├── .gitignore
├── components.json
├── ecosystem.config.js
├── eslint.config.mjs
├── LICENSE
├── next-env.d.ts
├── next.config.js
├── package.json
├── package-lock.json
├── postcss.config.js
├── postcss.config.mjs
├── tailwind.config.js
└── README.md
```

---

## 🤝 Contributing

We welcome contributions!

1. **Fork** the repository
2. **Create** a branch: `git checkout -b feature/your-feature`
3. **Commit** changes: `git commit -m "Add your feature"`
4. **Push** the branch: `git push origin feature/your-feature`
5. **Open a pull request** with a clear description

Please follow project style guides and test your code before submitting.

---

## 🪪 License

Licensed under the **MIT License**. See the [`LICENSE`](./LICENSE) file for full terms.

---

## 📬 Contact

Built with ❤️ for environmental monitoring and air quality analysis.

For inquiries, reach out to **Phantom** at:\
📧 `posiayoola102@gmail.com`

Or open an [issue on GitHub](https://github.com/your-username/pm25-dashboard/issues) if you spot a bug or have a feature request.

