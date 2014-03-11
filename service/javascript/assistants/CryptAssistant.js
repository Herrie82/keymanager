/*jslint node: true */
/*global getAppId, KeyStore, crypto, debug */

/* Validate contact username/password */
var CryptAssistant = function () {
    "use strict";
};

CryptAssistant.prototype.run = function (outerfuture) {
    "use strict";
	var args = this.controller.args, future, appId;

    appId = getAppId(this.controller);
    if (!appId) {
        outerfuture.result = { returnValue: false, errorText: "Could not determine appId."};
        return outerfuture;
    }

    if (!args.keyname) {
        outerfuture.result = {returnValue: false, errorText: "Need keyname parameter"};
        return outerfuture;
    }

    if (args.mode !== "CBC" && args.mode !== "CFB" && args.mode !== "ECB" &&
                    args.mode !== "none") {
        //outerfuture.result = {returnValue: false, errorText: "Need valid mode parameter"};
        //return outerfuture;
        args.mode = "CBC";
    }

    future = KeyStore.getKeyDecryptedByName(appId, args.keyname);

    future.then(this, function keyCB() {
        var result = future.result, algorithm, cipher, buffer, keydata, iv, resData = new Buffer("");
        if (result.returnValue === true) {
            if (args.algorithm !== result.type) {
                outerfuture.result = {returnValue: false, errorText: "Stored key algorithm and parameter differ."};
                return outerfuture;
            }

            keydata = new Buffer(result.keydata, "base64");
            debug("Keydata: ", keydata, " with length", keydata.length);
            algorithm = result.type + "-" + keydata.length * 8;
            if (args.mode !== "none") {
                algorithm += "-" + args.mode;
            }
            try {
                if (args.iv) {
                    iv = new Buffer(args.iv, "base64");
                    if (args.decrypt) {
                        debug(algorithm, " for decryption with iv.");
                        cipher = crypto.createDecipheriv(algorithm, keydata, iv);
                    } else {
                        debug(algorithm, " for encryption with iv.");
                        cipher = crypto.createCipheriv(algorithm, keydata, iv);
                    }
                } else {
                    if (args.decrypt) {
                        debug(algorithm, " for decryption.");
                        cipher = crypto.createDecipher(algorithm, keydata);
                    } else {
                        debug(algorithm, " for encryption.");
                        cipher = crypto.createCipher(algorithm, keydata);
                    }
                }

                if (args.pad === "none") {
                    debug("Deaktivating padding.");
                    cipher.setAutoPadding(false);
                }

                cipher.on("data", function dataCB(chunk) {
                    debug("Got chunk with length ", chunk.length);
                    resData = Buffer.concat([resData, chunk]);
                });

                cipher.on("end", function endCB() {
                    debug("Read " + resData.length + " data.");
                    outerfuture.result = {
                        returnValue: true,
                        data: resData.toString("base64")
                    };
                });

                buffer = new Buffer(args.data, "base64");
                debug("Writing " + buffer.length + " bytes of data.");
                cipher.write(buffer);
                cipher.end();
            } catch (e) {
                outerfuture.result = {returnValue: false, errorText: e.message};
            }
        } else {
            outerfuture.result = result;
        }
    });

    return outerfuture;
};