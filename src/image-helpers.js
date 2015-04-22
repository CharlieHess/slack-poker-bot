const rx = require('rx');
const im = require('imagemagick');

class ImageHelpers {
  
  static concatenateImages(imagePaths, outputFile, margin=4) {
    return rx.Observable.create((subj) => {
      let callback = (err, stdout, stderr) => {
        if (err) {
          console.log(stderr);
          subj.onError(err);
        } else {
          console.log(stdout);
          subj.onNext();
          subj.onCompleted();
        }
      };

      im.montage([imagePaths, 
        '-mode', 'concatenate',               // Append the images next to each other
        '-tile', 'x1',                        // Lay them out in a single row
        '-geometry', `+${margin}+${margin}`,  // Add a margin between each image
        outputFile],                          // Specify the output file
        callback);
    });
  }
}

module.exports = ImageHelpers;