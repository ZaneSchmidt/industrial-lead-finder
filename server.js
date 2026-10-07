const express = require("express");
const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, ".env")
});

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));


/*
====================================================
SEARCH TERMS
====================================================
*/

const queries = {

  "CNC Machining": [
    "CNC machine shop",
    "CNC machining",
    "precision machining"
  ],

  "Machining": [
    "machine shop",
    "machining",
    "precision machining"
  ],

  "Welding": [
    "welding shop",
    "welding fabrication",
    "industrial welding"
  ],

  "Fabrication": [
    "metal fabrication",
    "steel fabrication",
    "industrial fabrication"
  ],

  "Sheet Metal": [
    "sheet metal fabrication",
    "sheet metal shop",
    "sheet metal"
  ],

  "Laser Cutting": [
    "laser cutting",
    "laser cutting metal",
    "metal laser cutting"
  ],

  "Plasma Cutting": [
    "plasma cutting",
    "plasma cutting metal"
  ],

  "Waterjet": [
    "waterjet cutting",
    "water jet cutting"
  ],

  "Powder Coating": [
    "powder coating",
    "powder coat"
  ],

  "Industrial Painting": [
    "industrial painting",
    "industrial coating",
    "industrial paint"
  ],

  "Stamping": [
    "metal stamping",
    "metal stamping shop",
    "stamping"
  ],

  "Grinding": [
    "metal grinding",
    "precision grinding",
    "grinding shop"
  ],

  "Tube Bending": [
    "tube bending",
    "pipe bending",
    "metal tube bending"
  ],

  "Assembly": [
    "industrial assembly",
    "manufacturing assembly",
    "contract assembly"
  ]

};


/*
====================================================
SEARCH BUSINESSES
====================================================
*/

app.post("/api/search", async (req, res) => {

  try {

    const {
      location,
      radiusMiles = 25,
      processes = []
    } = req.body;


    if (!location || !processes.length) {

      return res.status(400).json({
        error: "Location and process required"
      });

    }


    if (!process.env.GOOGLE_MAPS_API_KEY) {

      return res.status(500).json({
        error: "Missing GOOGLE_MAPS_API_KEY"
      });

    }


    /*
    ================================================
    GEOCODE ZIP CODE / ADDRESS
    ================================================
    */

    const geoUrl =
      "https://maps.googleapis.com/maps/api/geocode/json" +
      "?address=" +
      encodeURIComponent(location) +
      "&key=" +
      process.env.GOOGLE_MAPS_API_KEY;


    const geoResponse =
      await fetch(geoUrl);


    const geoData =
      await geoResponse.json();


    if (
      geoData.status !== "OK" ||
      !geoData.results ||
      !geoData.results.length
    ) {

      return res.status(400).json({

        error:
          "Google Geocoding error: " +
          (geoData.status || "UNKNOWN") +
          (
            geoData.error_message
              ? " - " + geoData.error_message
              : ""
          )

      });

    }


    /*
    IMPORTANT:
    Google Geocoding uses:
      lat
      lng

    We keep those names here.
    */

    const center = {

      lat:
        Number(
          geoData.results[0]
            .geometry
            .location
            .lat
        ),

      lng:
        Number(
          geoData.results[0]
            .geometry
            .location
            .lng
        )

    };


    console.log(
      "Search center:",
      center
    );


    /*
    ================================================
    GOOGLE PLACES SEARCH RADIUS
    ================================================
    */

    const searchRadiusMeters =
      Math.min(
        Number(radiusMiles) * 1609.344,
        50000
      );


    /*
    ================================================
    STORE UNIQUE BUSINESSES
    ================================================
    */

    const all = new Map();


    /*
    ================================================
    SEARCH EACH PROCESS
    ================================================
    */

    for (
      const processName of processes
    ) {

      const searchTerms =
        queries[processName] ||
        [processName];


      for (
        const q of searchTerms
      ) {

        console.log(
          "Searching Google for:",
          q
        );


        const body = {

          textQuery: q,

          pageSize: 20,

          locationBias: {

            circle: {

              center: {

                latitude:
                  center.lat,

                longitude:
                  center.lng

              },

              radius:
                searchRadiusMeters

            }

          }

        };


        /*
        ============================================
        GOOGLE PLACES API
        ============================================
        */

        const response =
          await fetch(
            "https://places.googleapis.com/v1/places:searchText",
            {

              method: "POST",

              headers: {

                "Content-Type":
                  "application/json",

                "X-Goog-Api-Key":
                  process.env.GOOGLE_MAPS_API_KEY,

                "X-Goog-FieldMask":
                  [
                    "places.id",
                    "places.displayName",
                    "places.formattedAddress",
                    "places.location",
                    "places.nationalPhoneNumber",
                    "places.websiteUri",
                    "places.types"
                  ].join(",")

              },

              body:
                JSON.stringify(body)

            }
          );


        /*
        GOOGLE API ERROR
        */

        if (!response.ok) {

          const errorText =
            await response.text();


          console.error(
            "Google Places error:",
            errorText
          );


          return res.status(
            response.status
          ).json({

            error:
              "Google Places error: " +
              errorText

          });

        }


        /*
        READ GOOGLE RESULTS
        */

        const data =
          await response.json();


        console.log(
          "Google returned:",
          (data.places || []).length,
          "places for:",
          q
        );


        /*
        ============================================
        ADD BUSINESSES
        ============================================
        */

        for (
          const place
          of data.places || []
        ) {

          if (!place.id) {
            continue;
          }


          /*
          CREATE BUSINESS
          */

          if (!all.has(place.id)) {

            all.set(
              place.id,
              {

                id:
                  place.id,

                name:
                  place.displayName?.text ||
                  "Unknown Business",

                address:
                  place.formattedAddress ||
                  "",

                phone:
                  place.nationalPhoneNumber ||
                  "",

                website:
                  place.websiteUri ||
                  "",

                /*
                Google Places uses latitude
                and longitude.
                */

                lat:
                  Number(
                    place.location?.latitude
                  ),

                lon:
                  Number(
                    place.location?.longitude
                  ),

                processes:
                  []

              }
            );

          }


          /*
          ADD PROCESS TO BUSINESS
          */

          const business =
            all.get(place.id);


          if (
            !business.processes.includes(
              processName
            )
          ) {

            business.processes.push(
              processName
            );

          }

        }

      }

    }


    /*
    ================================================
    CALCULATE DISTANCES
    ================================================
    */

    const leads = [];


    for (
      const business
      of all.values()
    ) {

      if (
        !Number.isFinite(
          business.lat
        ) ||
        !Number.isFinite(
          business.lon
        )
      ) {

        console.log(
          "Skipping business with bad coordinates:",
          business.name
        );

        continue;

      }


      /*
      IMPORTANT FIX:
      center.lng is the Google longitude.
      business.lon is our stored longitude.
      */

      const distanceMiles =
        calculateDistance(
          center.lat,
          center.lng,
          business.lat,
          business.lon
        );


      console.log(
        "Business:",
        business.name,
        "Distance:",
        distanceMiles,
        "miles"
      );


      /*
      KEEP ONLY BUSINESSES
      INSIDE USER'S SELECTED RADIUS
      */

      if (
        distanceMiles <=
        Number(radiusMiles)
      ) {

        leads.push({

          ...business,

          distanceMiles,

          score:
            calculateScore(
              business
            )

        });

      }

    }


    /*
    ================================================
    SORT BEST LEADS FIRST
    ================================================
    */

    leads.sort(
      (a, b) =>
        b.score - a.score
    );


    console.log(
      "Total unique Google businesses:",
      all.size
    );


    console.log(
      "Businesses inside radius:",
      leads.length
    );


    console.log(
      "Search:",
      location,
      radiusMiles,
      processes.join(", "),
      "Results:",
      leads.length
    );


    /*
    SEND RESULTS TO APP
    */

    res.json({

      leads

    });


  } catch (error) {

    console.error(
      "SERVER ERROR:",
      error
    );


    res.status(500).json({

      error:
        error.message ||
        "Unknown server error"

    });

  }

});


/*
====================================================
DISTANCE CALCULATOR
====================================================
*/

function calculateDistance(
  lat1,
  lon1,
  lat2,
  lon2
) {

  const R =
    3958.7613;


  const latitude1 =
    Number(lat1);


  const longitude1 =
    Number(lon1);


  const latitude2 =
    Number(lat2);


  const longitude2 =
    Number(lon2);


  if (
    !Number.isFinite(latitude1) ||
    !Number.isFinite(longitude1) ||
    !Number.isFinite(latitude2) ||
    !Number.isFinite(longitude2)
  ) {

    return 9999;

  }


  const dLat =
    (
      latitude2 -
      latitude1
    ) *
    Math.PI /
    180;


  const dLon =
    (
      longitude2 -
      longitude1
    ) *
    Math.PI /
    180;


  const lat1Rad =
    latitude1 *
    Math.PI /
    180;


  const lat2Rad =
    latitude2 *
    Math.PI /
    180;


  const a =
    Math.sin(
      dLat / 2
    ) ** 2 +

    Math.cos(
      lat1Rad
    ) *

    Math.cos(
      lat2Rad
    ) *

    Math.sin(
      dLon / 2
    ) ** 2;


  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );


  const distance =
    R * c;


  return Math.round(
    distance * 10
  ) / 10;

}


/*
====================================================
LEAD SCORING
====================================================
*/

function calculateScore(
  business
) {

  let score =
    45;


  /*
  MULTIPLE PROCESSES
  */

  score +=
    Math.min(
      business.processes.length * 10,
      30
    );


  /*
  WEBSITE
  */

  if (
    business.website
  ) {

    score += 5;

  }


  /*
  PHONE
  */

  if (
    business.phone
  ) {

    score += 5;

  }


  /*
  HIGH-VALUE INDUSTRIAL PROCESSES
  */

  const highValueProcesses = [

    "Fabrication",
    "Welding",
    "Sheet Metal",
    "Laser Cutting",
    "Plasma Cutting",
    "Stamping",
    "Machining",
    "CNC Machining"

  ];


  if (
    business.processes.some(
      processName =>
        highValueProcesses.includes(
          processName
        )
    )
  ) {

    score += 15;

  }


  return Math.min(
    100,
    score
  );

}


/*
====================================================
SERVE WEBSITE
====================================================
*/

app.get(
  "*",
  (req, res) => {

    res.sendFile(
      path.join(
        __dirname,
        "public",
        "index.html"
      )
    );

  }
);


/*
====================================================
START SERVER
====================================================
*/

console.log(
  "Google API key loaded:",
  !!process.env.GOOGLE_MAPS_API_KEY
);


app.listen(
  process.env.PORT || 3000,
  () => {

    console.log(
      "Industrial Lead Finder running"
    );

  }
);