// seeds.js
require('dotenv').config({ path: './config/config.env' });
const mongoose = require('mongoose');
const Restaurant = require('../models/Restaurant');
const connectDB = require('../config/db');

const restaurants = [
  {
    name: 'Baan Suan Thai Kitchen',
    address: '123 Sukhumvit 24',
    district: 'Khlong Toei',
    province: 'Bangkok',
    postalcode: '10110',
    tel: '02-258-1234',
    openTime: '10:00',
    closeTime: '21:00',
    image: "https://plus.unsplash.com/premium_photo-1661883237884-263e8de8869b?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8cmVzdGF1cmFudHxlbnwwfHwwfHx8MA%3D%3D&fm=jpg&q=60&w=3000"
  },
  {
    name: 'Sukhumvit Noodle Bar',
    address: '55 Sukhumvit 63 (Ekamai)',
    district: 'Watthana',
    province: 'Bangkok',
    postalcode: '10110',
    tel: '02-714-7788',
    openTime: '11:00',
    closeTime: '22:00',
    image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=2070"
  },
  {
    name: 'Chao Phraya Seafood House',
    address: '12 Charoen Krung 50',
    district: 'Bang Rak',
    province: 'Bangkok',
    postalcode: '10500',
    tel: '02-236-9090',
    openTime: '12:00',
    closeTime: '22:30',
    image: "https://plus.unsplash.com/premium_photo-1661953124283-76d0a8436b87?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=2088"
  },
  {
    name: 'Old Town Curry & Rice',
    address: '200 Ratchadamnoen Klang Rd',
    district: 'Phra Nakhon',
    province: 'Bangkok',
    postalcode: '10200',
    tel: '02-222-4455',
    openTime: '09:00',
    closeTime: '20:00',
    image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1974"
  },
  {
    name: 'Victory Pho & Grill',
    address: '18 Ratchaprarop Rd',
    district: 'Ratchathewi',
    province: 'Bangkok',
    postalcode: '10400',
    tel: '02-246-8899',
    openTime: '10:30',
    closeTime: '21:30',
    image: "https://images.unsplash.com/photo-1552566626-52f8b828add9?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=2070"
  },
  {
    name: 'Ari Garden Bistro',
    address: '28 Ari Soi 1',
    district: 'Phaya Thai',
    province: 'Bangkok',
    postalcode: '10400',
    tel: '02-279-1313',
    openTime: '10:00',
    closeTime: '22:00',
    image: "https://images.unsplash.com/photo-1579027989536-b7b1f875659b?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=2070"
  },
  {
    name: 'Silom Street Eats',
    address: '140 Silom Rd',
    district: 'Sathon',
    province: 'Bangkok',
    postalcode: '10120',
    tel: '02-234-7575',
    openTime: '11:00',
    closeTime: '23:00',
    image: "https://images.unsplash.com/photo-1559339352-11d035aa65de?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1974"
  },
  {
    name: 'Chatuchak Grill & Brew',
    address: '8 Phahonyothin Rd (Gate 2 JJ)',
    district: 'Chatuchak',
    province: 'Bangkok',
    postalcode: '10900',
    tel: '02-272-4444',
    openTime: '10:00',
    closeTime: '21:00',
    image: "https://images.unsplash.com/photo-1560053608-13721e0d69e8?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=2070"
  },
  {
    name: 'Rama IX Noodle Station',
    address: '99 Rama IX Rd',
    district: 'Huai Khwang',
    province: 'Bangkok',
    postalcode: '10310',
    tel: '02-245-9900',
    openTime: '09:30',
    closeTime: '20:30',
    image: "https://images.unsplash.com/photo-1504981983529-9ed8031ade7f?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=2070"
  },
  {
    name: 'Thonglor Sushi & Izakaya',
    address: '88 Thong Lo 10',
    district: 'Watthana',
    province: 'Bangkok',
    postalcode: '10110',
    tel: '02-392-7070',
    openTime: '12:00',
    closeTime: '23:00',
    image: "https://images.unsplash.com/photo-1518188770546-efd25d4ca263?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=2071"
  },
];

const restaurantSeeds = async () => {
  try {
    await connectDB();

    console.log('Seed Connected to MongoDB');

    // Optional: clear existing restaurants first
    await Restaurant.deleteMany({});
    console.log('Cleared existing restaurants');

    const result = await Restaurant.insertMany(restaurants);
    console.log(`Inserted ${result.length} restaurants ✅`);

  } catch (err) {
    console.error('Seeding error:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

restaurantSeeds();
