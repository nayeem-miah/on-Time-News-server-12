const express = require("express");
const cors = require("cors");
require("dotenv").config();
// const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion } = require("mongodb");
const app = express();

const port = process.env.PORT || 5000;

// middlewares

app.use(
  cors({
    origin: ["http://localhost:5173"],
  })
);
app.use(express.json());

// console.log(process.env.DB_PASS);

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bomlehy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
      // -------------------------------collection --------------------
    const articleCollection = client.db("OnTimeNewsDB").collection("articles");


    app.post('/articles', async(req,res)=>{
      const newArticles = req.body;
      const result = await articleCollection.insertOne(newArticles);
      res.send(result)
    })

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// ----------------------------------------
app.get("/", (req, res) => {
  res.send("OnTimes News is Running");
});

app.listen(port, () => {
  console.log(`OnTimes News is sitting on prot ${port}`);
});
