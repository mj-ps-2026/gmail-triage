const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Hello World</title>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;600&display=swap" rel="stylesheet">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          min-height: 100vh;
          background: linear-gradient(135deg, #ff6b6b, #feca57, #ff9ff3, #ff6b6b);
          background-size: 300% 300%;
          animation: sunsetShift 10s ease infinite;
          font-family: 'Poppins', sans-serif;
        }
        .hero {
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .container {
          text-align: center;
          animation: fadeIn 1s ease-out, float 3s ease-in-out infinite;
        }
        h1 {
          font-size: 5rem;
          font-weight: 600;
          color: white;
          text-shadow: 0 4px 20px rgba(0,0,0,0.3);
          letter-spacing: -2px;
        }
        .hero p {
          font-size: 1.2rem;
          color: rgba(255,255,255,0.9);
          margin-top: 1rem;
          font-weight: 300;
        }
        .description {
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          background: rgba(0,0,0,0.2);
          padding: 4rem 2rem;
        }
        .description-content {
          max-width: 700px;
          text-align: center;
          color: white;
        }
        .description h2 {
          font-size: 2.5rem;
          font-weight: 600;
          margin-bottom: 1.5rem;
          text-shadow: 0 2px 10px rgba(0,0,0,0.2);
        }
        .description p {
          font-size: 1.1rem;
          line-height: 1.8;
          color: rgba(255,255,255,0.9);
          font-weight: 300;
        }
        .product-card {
          background: rgba(255,255,255,0.15);
          backdrop-filter: blur(10px);
          border-radius: 20px;
          padding: 2.5rem;
          margin-top: 2rem;
          box-shadow: 0 8px 32px rgba(0,0,0,0.1);
        }
        .product-card h3 {
          font-size: 1.5rem;
          margin-bottom: 1rem;
          font-weight: 600;
        }
        .product-card p {
          font-size: 1rem;
        }
        .price {
          font-size: 2rem;
          font-weight: 600;
          color: #fff;
          margin-top: 1rem;
          display: block;
        }
        @keyframes sunsetShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      </style>
    </head>
    <body>
      <section class="hero">
        <div class="container">
          <h1>Hello World</h1>
          <p>Welcome to my Node.js app</p>
        </div>
      </section>

      <section class="description">
        <div class="description-content">
          <h2>Introducing: Sunset Voice Assistant</h2>
          <p>Experience the future of voice interaction with our revolutionary AI-powered assistant. Sunset Voice Assistant understands context, learns your preferences, and anticipates your needs before you even ask.</p>
          
          <div class="product-card">
            <h3>Why Choose Sunset?</h3>
            <p>Natural conversation, privacy-first design, and seamless integration with all your devices. Built with cutting-edge neural networks for the most human-like interactions possible.</p>
            <span class="price">$99.99</span>
          </div>
        </div>
      </section>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});