let chart;

document.getElementById("predictForm").addEventListener("submit", (e) => {
  e.preventDefault();
  runPrediction();
  setInterval(() => {
    const price = document.getElementById("targetPrice").value;
    const time = document.getElementById("targetTime").value;
    if (price && time) runPrediction();
  }, 10000);
});

async function runPrediction() {
  const targetPrice = parseFloat(document.getElementById("targetPrice").value);
  const targetTime = new Date(document.getElementById("targetTime").value);
  const now = new Date();
  const minutesAhead = Math.max(1, Math.floor((targetTime - now) / 60000));
  if (minutesAhead <= 0) {
    document.getElementById("result").innerHTML = "⛔ Invalid future time!";
    return;
  }

  // Fetch multiple timeframes
  const [m1, m5, m15] = await Promise.all([
    fetchKlines("1m", 30),
    fetchKlines("5m", 20),
    fetchKlines("15m", 20)
  ]);

  const prices1m = m1.map(d => parseFloat(d[4]));
  const prices5m = m5.map(d => parseFloat(d[4]));
  const prices15m = m15.map(d => parseFloat(d[4]));
  const volumes1m = m1.map(d => parseFloat(d[5]));

  const priceNow = prices1m.at(-1);
  const trendPerMin = (priceNow - prices1m[0]) / prices1m.length;
  let predictedPrice = priceNow + trendPerMin * minutesAhead;

  const ema1 = calculateEMA(prices1m.slice(-9));
  const ema5 = calculateEMA(prices5m.slice(-9));
  const ema15 = calculateEMA(prices15m.slice(-9));
  const emaTrend = ema1 - prices1m[prices1m.length - 10];

  const rsi1 = calculateRSI(prices1m.slice(-15));
  const rsi5 = calculateRSI(prices5m.slice(-15));
  const rsi15 = calculateRSI(prices15m.slice(-15));

  const { macd, signal } = calculateMACD(prices1m);
  const macdSignal = macd - signal;

  const { upper, lower, middle } = calculateBollingerBands(prices1m);
  const pricePos = (priceNow > upper) ? "above upper" : (priceNow < lower) ? "below lower" : "inside";

  const avgVolume = volumes1m.reduce((a, b) => a + b) / volumes1m.length;
  const currentVol = volumes1m.at(-1);
  const volumeStrong = currentVol > avgVolume;

  // Adjust predicted price based on indicators
  if (rsi1 < 30) predictedPrice += 25;
  else if (rsi1 > 70) predictedPrice -= 25;
  if (trendPerMin > 0 && emaTrend < 0) predictedPrice -= 20;
  else if (trendPerMin < 0 && emaTrend > 0) predictedPrice += 20;
  if (macdSignal < 0) predictedPrice -= 10;

  const prediction = predictedPrice >= targetPrice ? "Yes ✅" : "No ❌";

  // Weighted confidence scoring
  let confidence =
    (Math.min(30, Math.abs(trendPerMin * 1000))) +
    (volumeStrong ? 10 : 5) +
    ((macdSignal > 0) ? 15 : 5) +
    ((rsi1 < 70 && rsi1 > 30) ? 10 : 5) +
    ((pricePos === "below lower" || pricePos === "above upper") ? 15 : 5);

  confidence = Math.min(99, Math.max(40, Math.round(confidence)));

  // Explanation
  const explanation = `
    Trend is ${trendPerMin >= 0 ? "rising 📈" : "falling 📉"} on 1m.
    EMA(1m/5m/15m): ${ema1.toFixed(2)} / ${ema5.toFixed(2)} / ${ema15.toFixed(2)}.
    RSI(1m/5m/15m): ${rsi1.toFixed(1)}, ${rsi5.toFixed(1)}, ${rsi15.toFixed(1)}.
    Bollinger Band: Price is ${pricePos}.
    MACD ${macdSignal >= 0 ? "above" : "below"} signal line.
    Volume ${volumeStrong ? "high" : "low"}.
  `;

  const timeStamps = m1.map(d => new Date(d[0]).toLocaleTimeString());

  document.getElementById("result").innerHTML = `
    <p><b>Current Price:</b> ${priceNow.toFixed(2)} USDT</p>
    <p><b>Predicted Price @ ${targetTime.toLocaleTimeString()}:</b> ${predictedPrice.toFixed(2)} USDT</p>
    <p><b>Prediction:</b> <span class="${prediction.includes('Yes') ? 'prediction-yes' : 'prediction-no'}">${prediction}</span></p>
    <p class="confidence"><b>Confidence:</b> ${confidence}%</p>
    <hr>
    <p><b>MACD:</b> ${macd.toFixed(2)}, Signal: ${signal.toFixed(2)}</p>
    <p><b>Bollinger Bands:</b> Upper ${upper.toFixed(2)}, Lower ${lower.toFixed(2)}</p>
    <p><b>Volume (now vs avg):</b> ${currentVol.toFixed(2)} vs ${avgVolume.toFixed(2)}</p>
    <hr>
    <p class="explanation">🧠 <b>Explanation:</b><br>${explanation}</p>
    <canvas id="sparklineChart" height="50"></canvas>
  `;

  if (chart) chart.destroy();
  chart = new Chart(document.getElementById("sparklineChart"), {
    type: "line",
    data: {
      labels: timeStamps,
      datasets: [{
        data: prices1m,
        borderColor: "#1e90ff",
        fill: false,
        tension: 0.3,
        pointRadius: 0
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { x: { display: false }, y: { display: false } },
    }
  });
}

// ========== Helper Functions ==========

async function fetchKlines(interval, limit) {
  const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=${limit}`);
  return await res.json();
}

function calculateEMA(prices, period = 9) {
  const k = 2 / (period + 1);
  return prices.reduce((acc, price, i) => i === 0 ? price : price * k + acc * (1 - k), 0);
}

function calculateRSI(prices, period = 14) {
  if (prices.length <= period) return 50;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period || 1e-6;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function calculateMACD(prices) {
  const ema12 = calculateEMA(prices.slice(-26), 12);
  const ema26 = calculateEMA(prices.slice(-26), 26);
  const macd = ema12 - ema26;
  const signal = calculateEMA([macd], 9);
  return { macd, signal };
}

function calculateBollingerBands(prices, period = 20) {
  const sma = prices.reduce((a, b) => a + b, 0) / prices.length;
  const stdDev = Math.sqrt(prices.reduce((sum, p) => sum + Math.pow(p - sma, 2), 0) / prices.length);
  return {
    middle: sma,
    upper: sma + 2 * stdDev,
    lower: sma - 2 * stdDev
  };
}
