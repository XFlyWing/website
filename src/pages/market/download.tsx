import React from 'react';
import { Spin, message, Button } from 'antd';
import { withRouter } from 'react-router-dom';
import { isEmpty, get } from 'lodash';
import QRCode from 'qrcode.react';
import axios, { AxiosResponse } from 'axios';
import moment from 'moment';
import { handleError, judgeClient } from 'common/utils';
import './download.scss';

interface IObj {
  [key: string]: any
}

const DownloadPage = ({ match }: any) => {
  const [ isLoading, setIsLoading ] = React.useState(false);
  const [ hasDefault, setHasDefault ] = React.useState(false);
  const [ versionList, setVersionList ] = React.useState([] as any[]);
  const [ current, setCurrent ] = React.useState({ activeKey: '', pkg: {} } as IObj);
  const [ logo, setLogo ] = React.useState('');
  const [ showDownload, setShowDownload ] = React.useState(false);
  const [ name, setName ] = React.useState('');
  const client = judgeClient().toLowerCase();
  React.useEffect(() => {
    setIsLoading(true);
    axios
      .get(`/api/publish-items/${match.params.publishItemId}/distribution`, { params: { mobileType: client } )
      .then((response: AxiosResponse<IResponse<any>>) => {
        const { success, data, err } = response.data;
        if (success) {
          const { default: defaultVersion, versions } = data as { default: any, versions: { list: any[], total: number } };
          let vlist = versions.list || [];
          let has_default = false;
          if (defaultVersion) {
            const { id, updatedAt } = defaultVersion;
            const resources = defaultVersion.resources || [];
            let pkg = resources[0] || {};
            if (client !== 'pc') {
              pkg = resources.filter((item: IObj) => item.type === client)[0] || {};
            }
            const { meta = {}, type } = pkg;
            const activeKey = `${id}-${type}-${meta.fileId}`;
            setCurrent({ activeKey, pkg, updatedAt });
            has_default = resources.some((t: any) => t.type === client || (t.type === 'data' && client === 'pc'));
            setHasDefault(has_default);
          }
          const logStr = (get(vlist, '[0]') || {}).logo;
          const reg = /^https?:\/\/.*?\//i;
          const logoUrl = logStr ? `/${logStr.replace(reg, '')}` : '';
          setLogo(logoUrl);
          setName(data.name);
          setVersionList(vlist);
          if (client === 'pc') {
            const {resources= []} = vlist.find(t => t.isDefault) || {};
            const type = get(resources, '[0].type');
            setShowDownload(has_default && type === 'data');
          }else {
            setShowDownload(has_default);
          }
        } else {
          handleError(err);
        }
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, [ match.params.publishItemId ]);
  const handleChangePkg = (activeKey: string, pkg: IObj, updatedAt: string) => {
    const {type} = pkg;
    let download = false;
    if (type === 'data') {
      download = client === 'pc' && hasDefault;
    }else {
      download = client !== 'pc' && hasDefault;
    }
    setShowDownload(download);
    setCurrent({ activeKey, pkg, updatedAt });
  };
  const handleDownload = () => {
    if (isEmpty(current)) {
      message.error('???????????????????????????');
      return;
    }
    const { meta = {}, url, type }: IObj = current.pkg || {};
    if (client === 'pc' && type !== 'data') {
      message.info('?????????????????????');
      return;
    }
    const isInWeChat: boolean = /micromessenger/i.test(navigator.userAgent);
    if (isInWeChat) {
      message.info(`??????${client === 'ios' ? 'Safari' : ''}??????????????????????????????`);
      return;
    }
    let downloadUrl = url;
    if (client === 'ios') {
      const { installPlist = '' } = meta;
      if (!installPlist) {
        message.info('?????????????????????????????????????????????');
        return;
      }
      if (installPlist.indexOf('https://') === - 1) {
        message.info('?????????HTTPS????????????');
        return;
      }
      downloadUrl = `itms-services://?action=download-manifest&url=${installPlist}`;
    }
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.click();
    link.remove();
  };
  const byteToM = ({ meta }: IObj) => {
    const { byteSize = 0 } = meta || {};
    return byteSize ? `${(byteSize / 1024 / 1024).toFixed(2)}M` : '';
  };
  const versions = [ ...versionList ].map((item) => {
    const { resources = [], id, updatedAt, isDefault } = item;
    let packages = resources || [];
    if (client !== 'pc') {
      packages = packages.filter((pkg: IObj) => pkg.type === client);
    }
    if (!isDefault) {
      return null;
    }
    return packages.map((pkg: IObj) => {
      const { meta, name: vName, type } = pkg;
      const { version, fileId } = meta;
      const displayname = version ? `${version}-${vName}` : vName;
      const key = `${id}-${type}-${fileId}`;
      const isActive = key === current.activeKey;
      return (
        <li
          className={`version-item ${isActive ? 'active' : ''}`}
          data-a={type}
          key={key}
          onClick={() => {
            handleChangePkg(key, pkg, updatedAt);
          }}
        >
          {displayname}
        </li>
      );
    });
  });
  return (
    <Spin spinning={isLoading}>
      <div className="download gray-bg">
        <div className="content">
          <div className="card-container">
            <div className="qrcode-wrap">
              {
                client !== 'pc' && logo ? <img className="logo" src={logo} alt=""/> : <QRCode className="qrcode" value={window.location.href} level="H" bgColor="rgba(0,0,0,0)"/>
              }
            </div>
            <p className="app-name">{name}</p>
            <p className="tips download-notice">?????????????????????</p>
            <p className="tips download-notice">?????????????????????????????????: {window.location.href}</p>
            <div className="line"></div>
            {
              React.Children.count(versions) ? (
                <>
                  <ul className="version-list">{versions}</ul>
                  <p className="tips version-notice">{byteToM(current.pkg)}</p>
                  <p className="tips version-notice">?????????: {current.updatedAt ? moment(current.updatedAt).format('YYYY/MM/DD HH:mm') : '--'}</p>
                  <div className="button-wrap">
                    {
                      showDownload ? <Button type="primary" onClick={handleDownload}>??????{client === 'pc' ? '' : '??????'}</Button> : null
                    }
                  </div>
                </>
              ) : <p className="tips">???????????????????????????????????????</p>
            }
          </div>
        </div>
        <img className="bg-img" src="/images/download/download-bg@2x.png" alt=""/>
        <div className="bg-wrap">
          <img className="bg-img" src="/images/download/download-bg@2x.png" alt=""/>
          <img className="people" src="/images/download/download-r1@2x.png" alt=""/>
          <img className="water-mark" src="/images/download/download-c@2x.png" alt=""/>
          <img className="s1" src="/images/download/download-s1@2x.png" alt=""/>
          <img className="y1" src="/images/download/download-y1@2x.png" alt=""/>
          <img className="y2" src="/images/download/download-y2@2x.png" alt=""/>
        </div>
      </div>
    </Spin>
  );
};

export default withRouter(DownloadPage);
