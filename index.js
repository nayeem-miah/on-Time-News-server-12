const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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
    const userCollection = client.db("OnTimeNewsDB").collection("users");

    // middlewares verify token
    const verifyToken = (req, res, next) => {
      // console.log("inside verified token", req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
      });
      next();
    };

    // jwt related apis
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token: token });
    });
    // users related api----------------
    app.get("/users",verifyToken, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      // query email from database
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user Already existing", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // admin apis
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    // add and get articles
    app.get("/articles", async (req, res) => {
      const result = await articleCollection.find().toArray();
      res.send(result);
    });
    app.get("/articles/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await articleCollection.findOne(query);
      res.send(result);
    });

    app.post("/articles", async (req, res) => {
      const newArticles = req.body;
      const result = await articleCollection.insertOne(newArticles);
      res.send(result);
    });

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
