const rx = require('rx');
const lwip = require('lwip');
const imgur = require('imgur');
const promisify = require('promisify-node');

const openImage = promisify(lwip.open);
const createImage = promisify(lwip.create);

class ImageHelpers {

  // Public: Combines three card images into a single row using the
  // light-weight image processing library (`lwip`), then converts the result
  // into a base-64 encoded string and uploads it using the `imgur` API.
  //
  // imageFiles - An array of three image files
  // upload - (Optional) Defaults to `imgur`, but can be overridden for testing
  //
  // Returns an {Observable} that will `onNext` with the URL of the combined
  // image, or `onError` if anything goes wrong
  static createFlopImage(imageFiles, upload=imgur.uploadBase64) {
    let images = [];
    let subj = new rx.Subject();

    // First, open each image and store off a reference to it
    openImage(imageFiles[0])
      .then((firstImage) => {
        images.push(firstImage);
        return openImage(imageFiles[1]);
      })
      .then((secondImage) => {
        images.push(secondImage);
        return openImage(imageFiles[2]);
      })
      .then((thirdImage) => {
        images.push(thirdImage);

        let combinedWidth = images[0].width() + images[1].width() + images[2].width();
        let originalHeight = images[0].height();

        // Next, create a blank image that can hold all three
        return createImage(combinedWidth, originalHeight, 'white');
      })

      // Now paste each image onto the destination image
      .then((destImage) => ImageHelpers.paste(images[0], destImage, 0, 0))
      .then((destImage) => ImageHelpers.paste(images[1], destImage, images[0].width(), 0))
      .then((destImage) => ImageHelpers.paste(images[2], destImage, images[0].width() + images[1].width(), 0))

      // Finally, convert the result to a base-64 string and upload it
      .then((destImage) => ImageHelpers.toBuffer(destImage))
      .then((buffer) => upload(buffer.toString('base64')))
      .then((result) => {
        subj.onNext(result.data.link);
        subj.onCompleted();
      })
      .catch((err) => {
        subj.onError(err);
      });

    return subj;
  }

  // Private: Returns a Promisified version of the `paste` method
  //
  // src - The image to paste
  // dest - The target image for the paste operation
  // x - The x-coordinate of the paste
  // y - The y-coordinate of the paste
  //
  // Returns a {Promise} of the resulting image
  static paste(src, dest, x, y) {
    return new Promise((resolve, reject) => {
      dest.paste(x, y, src, (err, img) => {
        if (!err) {
          resolve(img);
        } else {
          reject(err);
        }
      });
    });
  }

  // Private: Returns a Promisified version of the `writeFile` method
  //
  // img - The image to write
  // outputFile - The output file path
  //
  // Returns a {Promise} indicating completion
  static writeFile(img, outputFile) {
    return new Promise((resolve, reject) => {
      img.writeFile(outputFile, (err) => {
        if (!err) {
          resolve(outputFile);
        } else {
          reject(err);
        }
      });
    });
  }

  // Private: Returns a Promisified version of the `toBuffer` method
  //
  // img - The image to convert
  //
  // Returns a {Promise} of the {Buffer}, encoded as a jpeg
  static toBuffer(img) {
    return new Promise((resolve, reject) => {
      img.toBuffer('jpg', {quality: 100}, (err, buffer) => {
        if (!err) {
          resolve(buffer);
        } else {
          reject(err);
        }
      });
    });
  }
}

module.exports = ImageHelpers;
