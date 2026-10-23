import { createWithRemoteLoader } from '@kne/remote-loader';
import { imConnectionProps } from './imConfig';

const ImConnection = createWithRemoteLoader({
  modules: ['components-trtc-conference:Im@ImConnection']
})(({ remoteModules }) => {
  const [Connection] = remoteModules;
  return <Connection {...imConnectionProps()} />;
});

export default ImConnection;
