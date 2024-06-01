const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

const verifyToken = (req, res, next) => {
  // console.log(req.headers.authorization.split(" ")[1]);
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "Unauthorized Access" });
  }
  const token = req.headers.authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorized Access" });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.7nkbk6a.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const userCollection = client.db("foodCapitalDB").collection("users");
    const menuCollection = client.db("foodCapitalDB").collection("menu");
    const reviewCollection = client.db("foodCapitalDB").collection("reviews");
    const cartCollection = client.db("foodCapitalDB").collection("carts");
    const paymentCollection = client.db("foodCapitalDB").collection("payments");

    // ----------------JWT SECURITY------------------------
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });
    // ----------------JWT SECURITY------------------------

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "Forbidden Access" });
      }
      next();
    };

    app.post("/users", async (req, res) => {
      const userInfo = req.body;
      const query = { email: userInfo.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return;
      }
      const result = await userCollection.insertOne(userInfo);
      res.send(result);
    });
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      // console.log(req.headers);
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.patch(
      "/users/admin/:id",
      verifyAdmin,
      verifyToken,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updateUserWithRole = {
          $set: {
            role: "admin",
          },
        };
        const result = await userCollection.updateOne(
          filter,
          updateUserWithRole
        );
        res.send(result);
      }
    );

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      console.log(email);
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Forbidden Access" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      try {
        const result = await userCollection.deleteOne(query);

        if (result.deletedCount === 1) {
          res.status(200).send({ message: "User successfully deleted" });
        } else {
          res.status(404).send({ message: "User not found" });
        }
      } catch (error) {
        res.status(500).send({ message: "An error occurred", error });
      }
      // const result=await userCollection.deleteOne(query);
      // res.send(result);
    });

    app.post("/menu", verifyToken, verifyAdmin, async (req, res) => {
      const menuItemData = req.body;
      const result = await menuCollection.insertOne(menuItemData);
      res.send(result);
    });

    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    });

    app.get("/menu/:id",async(req,res)=>{
      const id=req.params.id;
      const query={_id:new ObjectId(id)};
      const result=await menuCollection.findOne(query);
      res.send(result);
    })

    app.put("/menu/:id",verifyToken,verifyAdmin,async(req,res)=>{
      const id=req.params.id;
      const menuItemData=req.body;
      console.log(menuItemData);
      const filter={_id:new ObjectId(id)};
      const options={upsert:true};
      const updatedMenuItemData={
        $set:{
          ...menuItemData
        }
      }
      const result=await menuCollection.updateOne(filter,updatedMenuItemData,options);
      res.send(result);
    })

    app.delete("/menu/:id",verifyToken,verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      try {
        const result=await menuCollection.deleteOne(query);
        if(result.deletedCount===1){
          res.status(200).send({message:"Menu item successfully deleted"})
        }
        else{
          res.status(404).send({message:"Menu item not found"})
        }
      } catch (error) {
        res.status(500).send({message:"An error occurred",error})
      }
    });

    app.post("/carts", async (req, res) => {
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem);
      res.send(result);
    });

    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      const query = { userEmail: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      try {
        const result = await cartCollection.deleteOne(query);

        if (result.deletedCount === 1) {
          res.status(200).send({ message: "Item successfully deleted" });
        } else {
          res.status(404).send({ message: "Item not found" });
        }
      } catch (error) {
        res.status(500).send({ message: "An error occurred", error });
      }
    });

    // Payment related api
    app.post("/create-payment-intent",async(req,res)=>{
      const {price}=req.body;
      const amount=parseInt(price*100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types:["card"],
      });
      res.send({
        clientSecret:paymentIntent.client_secret
      })
    })

    app.post("/payments",async(re,res)=>{
      const paymentInfo=req.body; 
      const paymentResult=await paymentCollection.insertOne(paymentInfo);

      const query={_id:{
        $in:paymentInfo.cardIds.map(id=>new ObjectId(id))
      }}
      const deleteResult=await cartCollection.deleteMany(query);

      res.send(paymentResult,deleteResult)
    })

    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Food Capital server is all ok");
});
app.listen(port, () => {
  console.log(`This server is running on port: ${port}`);
});
