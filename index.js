const express = require('express');
const cors = require('cors');
const mongoose = require("mongoose");
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./models/User.js');
const Place = require('./models/Place.js');
const Booking = require('./models/Booking.js');
const cookieParser = require('cookie-parser');
const imageDownloader = require('image-downloader');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const multer = require('multer');
const fs = require('fs');
const mime = require('mime-types');

require('dotenv').config();
const app = express();

const bcryptSalt = bcrypt.genSaltSync(10);
const jwtSecret = 'fasefraw4r5r3wq45wdfgw34twdfg';
const bucket = 'dawid-booking-app';

app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(__dirname + '/uploads'));
const corsOptions = {
  origin: 'https://airbnb-frontend-iota.vercel.app',
  credentials: true, // Enable sending cookies and headers with credentials
};

app.use(cors(corsOptions));

function getUserDataFromReq(req) {
  return new Promise((resolve, reject) => {
    jwt.verify(req.cookies.token, jwtSecret, {}, async (err, userData) => {
      if (err) throw err;
      resolve(userData);
    });
  });
}

app.get("/", async (req, res) => {
  try {

    await mongoose.connect("mongodb+srv://ali:1234@nodeandexpress-projects.gnvwa.mongodb.net/?retryWrites=true&w=majority");
    console.log("database connected!");
    res.json("hello world")
  }
  catch (err) {
    console.log(err)
  }
})

app.get('/api/test', async (req, res) => {

  try {
    await mongoose.connect("mongodb+srv://ali:1234@nodeandexpress-projects.gnvwa.mongodb.net/?retryWrites=true&w=majority");
    console.log("database connected!");
    res.json('test ok');
  } catch (error) {
    console.log(error.message);
    process.exit;
  }
});

app.post('/api/register', async (req, res) => {
  console.log(req.body)
  mongoose.connect("mongodb+srv://ali:1234@nodeandexpress-projects.gnvwa.mongodb.net/?retryWrites=true&w=majority");
  const { name, email, password } = req.body;

  try {
    const userDoc = await User.create({
      name,
      email,
      password: bcrypt.hashSync(password, bcryptSalt),
    });
    res.json(userDoc);
  } catch (e) {
    res.status(422).json(e);
  }

});

app.post('/api/login', async (req, res) => {
  mongoose.connect("mongodb+srv://ali:1234@nodeandexpress-projects.gnvwa.mongodb.net/?retryWrites=true&w=majority");
  const { email, password } = req.body;
  const userDoc = await User.findOne({ email });
  console.log(userDoc);
  if (userDoc) {
    const passOk = bcrypt.compareSync(password, userDoc.password);
    if (passOk) {
      jwt.sign({
        email: userDoc.email,
        id: userDoc._id
      }, jwtSecret, {}, (err, token) => {
        if (err) throw err;
        console.log(token, userDoc)
        res.cookie('token', token).json(userDoc);
      });
    } else {
      res.status(422).json('pass not ok');
    }
  } else {
    res.json('not found');
  }
});

app.get('/api/profile', (req, res) => {
  mongoose.connect("mongodb+srv://ali:1234@nodeandexpress-projects.gnvwa.mongodb.net/?retryWrites=true&w=majority");
  const { token } = req.cookies;
  if (token) {
    jwt.verify(token, jwtSecret, {}, async (err, userData) => {
      if (err) throw err;
      const { name, email, _id } = await User.findById(userData.id);
      res.json({ name, email, _id });
    });
  } else {
    res.json(null);
  }
});

app.post('/api/logout', (req, res) => {
  res.cookie('token', '').json(true);
});


app.post('/api/upload-by-link', async (req, res) => {
  const { link } = req.body;
  const newName = 'photo' + Date.now() + '.jpg';
  await imageDownloader.image({
    url: link,
    dest: '/tmp/' + newName,
  });
  const url = await uploadToS3('/tmp/' + newName, newName, mime.lookup('/tmp/' + newName));
  res.json(url);
});

// const photosMiddleware = multer({ dest: '/tmp' });
// app.post('/api/upload', photosMiddleware.array('photos', 100), async (req, res) => {
//   const uploadedFiles = [];
//   for (let i = 0; i < req.files.length; i++) {
//     const { path, originalname, mimetype } = req.files[i];
//     const url = await uploadToS3(path, originalname, mimetype);
//     uploadedFiles.push(url);
//   }
//   res.json(uploadedFiles);
// });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads');
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});
const upload = multer({ storage: storage });

app.post('/api/upload', upload.array('photos', 100), (req, res) => {
  console.log(req.files)
  const uploadedFiles = req.files.map((file) => {
    // Construct the URL to access the uploaded file (assuming it's hosted by your server)
    const url = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;
    console.log(url);
    return url;
  });
  res.json(uploadedFiles);
});

app.post('/api/places', (req, res) => {
  mongoose.connect("mongodb+srv://ali:1234@nodeandexpress-projects.gnvwa.mongodb.net/?retryWrites=true&w=majority");
  const { token } = req.cookies;
  const {
    title, address, addedPhotos, description, price,
    perks, extraInfo, checkIn, checkOut, maxGuests,
  } = req.body;
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    if (err) throw err;
    const placeDoc = await Place.create({
      owner: userData.id, price,
      title, address, photos: addedPhotos, description,
      perks, extraInfo, checkIn, checkOut, maxGuests,
    });
    res.json(placeDoc);
  });
});

app.get('/api/user-places', (req, res) => {
  mongoose.connect("mongodb+srv://ali:1234@nodeandexpress-projects.gnvwa.mongodb.net/?retryWrites=true&w=majority");
  const { token } = req.cookies;
  console.log(token)
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    const data=await Place.find({ owner: userData.id })
    res.json(data);
  });
});

app.get('/api/places/:id', async (req, res) => {
  mongoose.connect("mongodb+srv://ali:1234@nodeandexpress-projects.gnvwa.mongodb.net/?retryWrites=true&w=majority");
  const { id } = req.params;
  res.json(await Place.findById(id));
});

app.put('/api/places', async (req, res) => {
  mongoose.connect("mongodb+srv://ali:1234@nodeandexpress-projects.gnvwa.mongodb.net/?retryWrites=true&w=majority");
  const { token } = req.cookies;
  const {
    id, title, address, addedPhotos, description,
    perks, extraInfo, checkIn, checkOut, maxGuests, price,
  } = req.body;
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    if (err) throw err;
    const placeDoc = await Place.findById(id);
    if (userData.id === placeDoc.owner.toString()) {
      placeDoc.set({
        title, address, photos: addedPhotos, description,
        perks, extraInfo, checkIn, checkOut, maxGuests, price,
      });
      await placeDoc.save();
      res.json('ok');
    }
  });
});

app.get('/api/places', async (req, res) => {
  mongoose.connect("mongodb+srv://ali:1234@nodeandexpress-projects.gnvwa.mongodb.net/?retryWrites=true&w=majority");
  res.json(await Place.find({}));
});

app.post('/api/bookings', async (req, res) => {
  mongoose.connect("mongodb+srv://ali:1234@nodeandexpress-projects.gnvwa.mongodb.net/?retryWrites=true&w=majority");
  const userData = await getUserDataFromReq(req);
  const {
    place, checkIn, checkOut, numberOfGuests, name, phone, price,
  } = req.body;
  Booking.create({
    place, checkIn, checkOut, numberOfGuests, name, phone, price,
    user: userData.id,
  }).then((doc) => {
    res.json(doc);
  }).catch((err) => {
    throw err;
  });
});



app.get('/api/bookings', async (req, res) => {
  mongoose.connect("mongodb+srv://ali:1234@nodeandexpress-projects.gnvwa.mongodb.net/?retryWrites=true&w=majority");
  const userData = await getUserDataFromReq(req);
  res.json(await Booking.find({ user: userData.id }).populate('place'));
});

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log(`SERVER listening ON port ${PORT}`);
});
