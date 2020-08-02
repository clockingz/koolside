import request from './request';

export default class IpData {
    static ipData: any = null;
    static ipDataAll: any = null;
    private static nextReqTimestamp = 0;
    private static nextReqTimestampAll = 0;

    public static async load() {
        // ip 정보 가져오기
        if (!this.ipData && this.nextReqTimestamp < Date.now()) {
            const res = await request('https://gist.githubusercontent.com/sokcuri/beab804bce01a6542b1215c817d20403/raw/bdf1c98e83e5e49c466ad2a433b8dd63265e7c7d/ip_data.json')
            const resText = res.responseText;
            this.nextReqTimestamp = Date.now() + 1000 * 60 * 5;
            try {
                this.ipData = JSON.parse(resText);
            } catch {
                throw new Error('ip info doest not fetch');
            }
        }
        if (!this.ipDataAll && this.nextReqTimestampAll < Date.now()) {
            const res = await request('https://gist.githubusercontent.com/sokcuri/9262b08a36585f3f698dcedeb5669210/raw/6be9fc4d9aa243e4f57a93a030e489eaae442d1f/ip_data_all.json')
            const resText = res.responseText;
            this.nextReqTimestampAll = Date.now() + 1000 * 60 * 5;
            try {
                this.ipDataAll = JSON.parse(resText);
            } catch {
                throw new Error('ip all info doest not fetch');
            }
        }

    }
}