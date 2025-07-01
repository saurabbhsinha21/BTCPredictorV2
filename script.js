let model;

async function loadModel() {
  try {
    model = await tf.loadLayersModel('tfjs_model/model.json');
    console.log("✅ Model loaded.");
  } catch (err) {
    console.error("❌ Failed to load model", err);
  }
}

async function predictBTC() {
  const targetPrice = parseFloat(document.getElementById('targetPrice').value);
  const targetTime = document.getElementById('targetTime').value;

  if (!targetPrice || !targetTime) {
    alert("Please enter both target price and time");
    return;
  }

  if (!model) {
    alert("Model not loaded");
    return;
  }

  // Generate dummy input data of shape [1, 30, 1]
  // You should replace this with real-time price data
  const inputData = tf.tensor3d([Array(30).fill(106000)], [1, 30, 1]);

  const prediction = model.predict(inputData);
  const predictedPrice = (await prediction.data())[0];

  const output = document.getElementById("output");
  output.innerText = `Predicted Price: ${predictedPrice.toFixed(2)} USDT\n
    Will it be above ${targetPrice}? → ${predictedPrice >= targetPrice ? 'Yes ✅' : 'No ❌'}`;
}

loadModel();
