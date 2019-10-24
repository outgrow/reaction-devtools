export default [{
  "name": "Default shipping provider",
  "methods": [{
    "name": "Free",
    "label": "Free Shipping",
    "group": "Ground",
    "rate": 0,
    "enabled": true,
    "validLocales": [{
      "deliveryBegin": 2,
      "deliveryEnd": 7
    }],
    "validRanges": [{
      "begin": 50
    }]
  }, {
    "name": "Standard",
    "label": "Standard",
    "group": "Ground",
    "rate": 2.99,
    "enabled": true,
    "validLocales": [{
      "deliveryBegin": 2,
      "deliveryEnd": 7
    }]
  }, {
    "name": "Priority",
    "label": "Priority",
    "group": "Priority",
    "rate": 6.99,
    "enabled": true,
    "validLocales": [{
      "deliveryBegin": 1,
      "deliveryEnd": 3
    }]
  }],
  "provider": {
    "name": "flatRates",
    "label": "Flat Rate"
  }
}];
