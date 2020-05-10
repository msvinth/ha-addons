'use strict';

const express = require('express');
const tesla = require('teslajs');
const geolib = require("geolib");
const fs = require('fs');

// Constants
const PORT = 8080;
const HOST = '0.0.0.0';

const home = {
    latitude: 55.649346,
    longitude: 12.243439
};

const tokenPath = "/data/"
const tokenFile = tokenPath + '.token';

const initialTokens =  {
    authToken: undefined,
    refreshToken: undefined,
    created: Date.now()
}

function hasTokenFile() {
    try {
        return fs.statSync(tokenFile).isFile();
    } catch (e) {
        return false;
    }
}

function deleteTokenFile() {
    try {
        return fs.unlinkSync(tokenFile);
    } catch (e) {
        return false;
    }
}

function readTokens() {
    if(hasTokenFile()) {
        const fileContent = fs.readFileSync(tokenFile, 'utf8');
        const tokens = JSON.parse(fileContent);
        if(!tokens.authToken || !tokens.refreshToken) {
            return {...initialTokens};
        }
        return tokens;
    } else {
        writeTokenFile(initialTokens);
        return {...initialTokens};
    }
}

function datediff(first, second) {
    // Take the difference between the dates and divide by milliseconds per day.
    // Round to nearest whole number to deal with DST.
    return Math.round((second-first)/(1000*60*60*24));
}

function writeTokenFile(tokens) {
    if(!fs.existsSync(tokenPath)) {
        fs.mkdirSync(tokenPath, { recursive: true });
    }
    fs.writeFileSync(tokenFile, JSON.stringify(tokens), 'utf8');
}

async function getAuthToken() {
    const tokens = readTokens();
    if(datediff(tokens.created, Date.now()) > 10) {
        await refreshToken(tokens);
    }
    return tokens.authToken;
}

async function refreshToken(tokens) {
    try {
        const result = await tesla.refreshTokenAsync(tokens.refreshToken);
        console.log(result);
        const {response, body, authToken, refreshToken} = result;
        tokens.authToken = authToken;
        tokens.refreshToken = refreshToken;
        tokens.created = Date.now();
    } catch(e) {
        console.error(e);
        return;
    }
    writeTokenFile(tokens);
}

 async function getOptions() {
    return {
        authToken: await getAuthToken(),
        vehicleID: "20029991982860431"
    }
}


 const oneMile = 1.60934;

function sleep(ms){
    return new Promise(resolve=>{
        setTimeout(resolve,ms)
    })
}

function isCharging(chargeState) {
    return chargeState.charging_state === "Charging" || chargeState.charging_state === "Starting";
}

// App
const app = express();
app.get('/open', async (req, res, next) => {
    try {
        const options = await getOptions();
        const driveStatePromise = tesla.driveStateAsync(options);
        const chargeStatePromise = tesla.chargeStateAsync(options);

        const driveState = await driveStatePromise;

        var distanceFromHome = geolib.getDistance(home, {latitude:driveState.latitude, longitude: driveState.longitude});
        if(distanceFromHome < 25) {
            let chargeState = await chargeStatePromise;
            if(isCharging(chargeState)) {
                const result = await tesla.stopChargeAsync(options);
                console.log("stopChargeAsync", result);
                for(let i = 0; i < 10; i++) {
                    await sleep(400);
                    chargeState = await tesla.chargeStateAsync(options);
                    if(!isCharging(chargeState)) {
                        break;
                    }
                }
            }

            await tesla.openChargePortAsync(options);
            res.json({ chargeport: true });
        }
    } catch (e) {
        console.error(e);
      //this will eventually be handled by your error handling middleware
      next(e);
    }
  });

  app.get('/climate', async (req, res, next) => {
    try {
        const options = await getOptions();
        const driveStatePromise = tesla.driveStateAsync(options);

        const driveState = await driveStatePromise;

        var distanceFromHome = geolib.getDistance(home, {latitude:driveState.latitude, longitude: driveState.longitude});
        if(distanceFromHome < 25) {

            await tesla.climateStartAsync(options);
            res.json({ climate: true });
        }
    } catch (e) {
        console.error(e);
      //this will eventually be handled by your error handling middleware
      next(e);
    }
  });


  app.get('/delete', async (req, res, next) => {
    try {
        deleteTokenFile();
        res.json({ deleted: true });
    } catch (e) {
        console.error(e);
      //this will eventually be handled by your error handling middleware
      next(e);
    }
  });

  app.get('/climatestop', async (req, res, next) => {
    try {
        const options = await getOptions();
        const driveStatePromise = tesla.driveStateAsync(options);

        const driveState = await driveStatePromise;

        var distanceFromHome = geolib.getDistance(home, {latitude:driveState.latitude, longitude: driveState.longitude});
        if(distanceFromHome < 25) {

            await tesla.climateStopAsync(options);
            res.json({ climate: true });
        }
    } catch (e) {
        console.error(e);
      //this will eventually be handled by your error handling middleware
      next(e);
    }
  });

  app.get('/unlock', async (req, res, next) => {
    try {
        const options = await getOptions();
        await tesla.doorUnlockAsync(options);
        res.json({ unlock: true });
    } catch (e) {
        console.error(e);
      //this will eventually be handled by your error handling middleware
      next(e);
    }
  });

  app.get('/opentrunk', async (req, res, next) => {
    try {
        const options = await getOptions();
        await tesla.openTrunkAsync(options);
        res.json({ opentrunk: true });
    } catch (e) {
        console.error(e);
      //this will eventually be handled by your error handling middleware
      next(e);
    }
  });

  app.get('/checktoken', async (req, res, next) => {
        try {
            const options = await getOptions();
            const tokens = readTokens();
            res.json({
                    token_age: datediff(tokens.created, Date.now())
                });
        } catch (e) {
            console.error(e);
            //this will eventually be handled by your error handling middleware
            next(e);
        }
    });

    app.get('/login', async (req, res, next) => {
        try {
            const username = req.query.username;
            const password = req.query.password;

            const result = await tesla.loginAsync(username, password);
            if(result.error) {
                throw result.error;
            }
            const tokens = {
                authToken: result.authToken,
                refreshToken: result.refreshToken,
                created: Date.now()
            };
            writeTokenFile(tokens);
            res.json({
                    result: "token writen",
                });
        } catch (e) {
            console.error(e);
            //this will eventually be handled by your error handling middleware
            next(e);
        }
    });

  app.get('/checkcharge', async (req, res, next) => {
    try {
        const options = await getOptions();

        const driveStatePromise = tesla.driveStateAsync(options);
        const chargeStatePromise = tesla.chargeStateAsync(options);

        const driveState = await driveStatePromise;

        var distanceFromHome = geolib.getDistance(home, {latitude:driveState.latitude, longitude: driveState.longitude});
        if(distanceFromHome < 25) {
            const chargeState = await chargeStatePromise;
            let chargeport = "connected";
            if(chargeState.charging_state === "Disconnected") {
                chargeport = "disconnected";
            }

            res.json({
                location: "home",
                chargeport: chargeport, 
                battery_level: chargeState.battery_level,
                ideal_battery_range: Math.round(oneMile * chargeState.ideal_battery_range)
             });

             return;
        }
        res.json({location: "not home"})
    } catch (e) {
        console.error(e);
      //this will eventually be handled by your error handling middleware
      next(e);
    }
  });

app.listen(PORT, HOST);
console.log(`Running on http://${HOST}:${PORT}`);
