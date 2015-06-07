const rx = require('rx');
const lwip = require('lwip');
const imgur = require('imgur');
const promisify = require('promisify-node');

const openImage = promisify(lwip.open);
const createImage = promisify(lwip.create);

class ImageHelpers {

  static combineThree(imageFiles) {
    let images = [];
    let subj = new rx.Subject();

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
        return createImage(combinedWidth, originalHeight, 'white');
      })
      .then((destImage) => ImageHelpers.paste(images[0], destImage, 0, 0))
      .then((destImage) => ImageHelpers.paste(images[1], destImage, images[0].width(), 0))
      .then((destImage) => ImageHelpers.paste(images[2], destImage, images[0].width() + images[1].width(), 0))
      .then((destImage) => ImageHelpers.toBuffer(destImage))
      .then((buffer) => imgur.uploadBase64(buffer.toString('base64')))
      .then((result) => {
        subj.onNext(result.data.link);
        subj.onCompleted();
      })
      .catch((err) => {
        subj.onError(err);
      });

    return subj;
  }

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
