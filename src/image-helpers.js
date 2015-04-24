const rx = require('rx');
const lwip = require('lwip');

class ImageHelpers {
  // Public: Combines two images in a single row, and writes the result to the
  // output file.
  //
  // first - The path to the first image
  // second - The path to the second image
  // outputFile - The output file path
  //
  // Returns an {Observable} that indicates completion or failure.
  static concatenateImages(first, second, outputFile) {
    let subj = new rx.Subject();
    
    lwip.open(first, (err, firstImage) => {
      if (err) subj.onError(err);
      
      let originalWidth = firstImage.width();
      let originalHeight = firstImage.height();
      
      lwip.open(second, (err, secondImage) => {
        if (err) subj.onError(err);
        
        let additionalWidth = secondImage.width();
        
        // Create a blank image that has enough space for both, with a white 
        // background.
        lwip.create(originalWidth + additionalWidth, originalHeight, 'white', (err, blankImage) => {
          if (err) subj.onError(err);
          
          blankImage.paste(0, 0, firstImage, (err, hasFirstImage) => {
            if (err) subj.onError(err);

            hasFirstImage.paste(originalWidth, 0, secondImage, (err, combinedImage) => {
              if (err) subj.onError(err);
              
              // After both images have been pasted, output the result.
              combinedImage.writeFile(outputFile, (err) => {
                if (err) {
                  subj.onError(err);
                } else {
                  subj.onNext(outputFile);
                  subj.onCompleted();
                }
              });
            });
          });
        });
      });
    });
    
    return subj;
  }
}

module.exports = ImageHelpers;