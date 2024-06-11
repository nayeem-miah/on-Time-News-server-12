const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

// middlewares
// console.log(process.env.STRIPE_SECRET_KEY);
app.use(
  cors({
    origin: ["http://localhost:5173",'https://b9a12-ontimenews.web.app','https://b9a12-ontimenews.firebaseapp.com/'],
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
    // <------------------------------collection -------------------->
    const articleCollection = client.db("OnTimeNewsDB").collection("articles");
    const userCollection = client.db("OnTimeNewsDB").collection("users");
    const publisherCollection = client.db("OnTimeNewsDB").collection("publisher");
    // const paymentCollection = client.db("OnTimeNewsDB").collection("payment");

    // middlewares verify token
    const verifyToken = (req, res, next) => {
      // console.log(" verified token", req.headers.authorization);
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
    // verifyAdmin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
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

    // payment----------create-payment-intent---------
    app.post("/create-payment-intent", async (req, res) => {
      const price = req.body.price;
      // generate client secret
      const priceCent = parseFloat(price) * 100;
      // console.log();
      if (priceCent < 1) return;
      const { client_secret } = await stripe.paymentIntents.create({
        amount: priceCent,
        currency: "usd",
        // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
        automatic_payment_methods: {
          enabled: true,
        },
      });
      // and client secret as response
      res.send({ clientSecret: client_secret });
    });
    // users related api----------------
    app.get("/users", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });
    app.get(
      "/users/admin/:email",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const email = req.params.email;
        if (email !== req.decoded.email) {
          return res.status(403).send({ message: "forbidden access" });
        }
        const query = { email: email };
        const user = await userCollection.findOne(query);
        let admin = false;
        if (user) {
          admin = user?.role === "admin";
        }
        res.send({ admin });
      }
    );
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

    // ---------admin apis--------------------------
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    //-------- all articles approved admin------------------
    app.patch("/admin-articles/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "approve",
        },
      };
      const result = await articleCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    //-------- all articles isPremium admin------------------
    app.patch(
      "/isPremium-articles/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            isPremium: "Premium",
          },
        };
        const result = await articleCollection.updateOne(filter, updateDoc);
        res.send(result);
      }
    );

    // --------view count --------------------------apis
    app.patch("/viewCount/:id", async (req, res) => {
      const view = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          viewCount: view.viewCount,
        },
      };
      const result = await articleCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    //  decline----------
    app.post("/decline/:id", async (req, res) => {
      const newDecline = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          decline: newDecline.decline,
        },
      };
      const result = await articleCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    // add and get articles
    app.get("/articles", verifyToken, async (req, res) => {
      const result = await articleCollection.find().toArray();
      res.send(result);
    });
    app.get("/articlesCount", async (req, res) => {
      const result = await articleCollection
        .find()
        .sort({ viewCount: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });
    app.get("/searchArticles", async (req, res) => {
      const search = req.query.search;
      // console.log(search);
      const query = {
        title: { $regex: search, $options: "i" },
      };
      const options = {};
      const result = await articleCollection.find(query, options).toArray();
      res.send(result);
    });

    app.get("/articlesIsPremuan", verifyToken, async (req, res) => {
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

    // My articles
    app.get("/myArticles/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await articleCollection.find(query).toArray();
      res.send(result);
    });

    // update articles
    app.get("/article/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await articleCollection.findOne(query);
      res.send(result);
    });
    app.patch("/updateArticles/:id", async (req, res) => {
      const article = req.body;
      // console.log(article);
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          title: article.title,
          publisher: article.publisher,
          tags: article.tags,
          description: article.description,
          image: article.image,
          email: article.email,
          photo: article.photo,
          displayName: article.displayName,
          viewCount: article.viewCount,
        },
      };
      const result = await articleCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    app.delete("/article/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await articleCollection.deleteOne(query);
      res.send(result);
    });

    // ------------------all publisher---------------------------->
    app.post("/publisher", verifyToken, verifyAdmin, async (req, res) => {
      const publisher = req.body;
      const result = await publisherCollection.insertOne(publisher);
      res.send(result);
    });
    app.get("/publisher", async (req, res) => {
      const result = await publisherCollection.find().toArray();
      res.send(result);
    });

    // -----------------payment info -----------------
    // app.post("/payment", async (req, res) => {
    //   const newPayment = req.body;
    //   const result = await paymentCollection.insertOne(newPayment);
    //   res.send(result);
    // });
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
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
