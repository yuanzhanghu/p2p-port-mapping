const WebRTC = require('./webRTC');
const peerOffer = new WebRTC();
const peerAnswer = new WebRTC();

peerOffer.makeOffer({ disable_stun: false });
peerOffer.on('signal', sdp => {
  console.log('offer signal');
  peerAnswer.makeAnswer(sdp, { disable_stun: false});
  peerAnswer.on('signal', sdp => {
    peerOffer.setAnswer(sdp);
  });
});
peerOffer.once('connect', () => {
  console.log('offer connected');
  peerOffer.on('data', data => console.log('ondata offer', data));
  peerOffer.send('hello', 'test');
  peerOffer.send('test', 'second');
});
peerAnswer.once('connect', () => {
  console.log('answer connected');
  peerAnswer.on('data', data => console.log('ondata answer', data));
  peerAnswer.send('hi', 'test');
  peerAnswer.send('test!!', 'third');
});
