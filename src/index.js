const crypto = require('crypto');
const BigNumber = require('bignumber.js');
const express = require('express')
const axios = require('axios').default;
const app = express()
const bodyParser = require('body-parser')
app.disable('x-powered-by');
const botToken = '';
const payOKSecret = '';
const shopID = 0;

app.use(bodyParser.urlencoded({
    extended: true
}))

function signBOT_T(paymentID, type, sum, currency, token) {
    const sign = crypto.createHash('md5')
        .update(`${paymentID}:${type}:${sum}:${currency}:${token}`)
        .digest("hex");
    return sign;
}

function signPayOK(secret, desc, currency, shop, payment, amount){
    const sign = crypto.createHash('md5')
        .update([ amount, payment, shop, currency, desc, secret].join('|'))
        .digest("hex");
    return sign;
}

function signPayOKCallback(secret, desc, currency, shop, payment_id, amount){
    const sign = crypto.createHash('md5')
        .update([secret, desc, currency, shop, payment_id, amount].join('|'))
        .digest("hex");
    return sign;
}

function signPaymentType(secret, type){
    const sign = crypto.createHash('md5')
        .update([ type, secret ].join('|'))
        .digest("hex");
    return sign;
}

function generatePayOK(secret, desc, currency, shop, payment, amount, bot_t_type, bot_t_type_sign) {
    const sign = signPayOK(secret, desc, currency, shop, payment, amount)
    return `https://payok.io/pay?amount=${amount}&payment=${payment}&shop=${shop}&desc=${encodeURIComponent(desc)}&currency=${currency}&sign=${sign}&payment_type=${bot_t_type}&pt_sign=${bot_t_type_sign}`
}

app.post('/paymentCallback', async (req, res) => {
    const desc = req.body.desc;
    const currency = req.body.currency;
    const shop = req.body.shop;
    const payment_id = req.body.payment_id;
    const amount = req.body.amount;
    const sign = req.body.sign;

    const signCallbackData = signPayOKCallback(payOKSecret, desc, currency, shop, payment_id, amount)
    console.log(req.body)
    if (sign === signCallbackData){
        const paymentTypeBot_T = req.body.custom?.payment_type;
        const paymentTypeBot_TSign = req.body.custom?.pt_sign;
        const queryTypeBot_TSign = signPaymentType(payOKSecret, paymentTypeBot_T)
        if(queryTypeBot_TSign === paymentTypeBot_TSign && paymentTypeBot_T === 'replenishment') {
            await axios({
                method: 'POST',
                url: 'https://api.bot-t.ru/v1/shop/replenishment/success',
                data: { id: payment_id, bot_id: '7582' },
                params: { token: botToken }
            })
            .then(function (response) {
                console.log(response.data.result, response.data.message)
                res
                    .status(200)
                    .send('OK')
            }).catch(console.log);
        } else {
            console.log('Wrong sign for payment type sign', queryTypeBot_TSign, paymentTypeBot_TSign)
            res.setHeader('content-type', 'text/plain');
            res
                .status(403)
                .send('Forbidden')
        }
    } else {
        console.log('Wrong sign for PayOK', sign, signCallbackData)
        res.setHeader('content-type', 'text/plain');
        res
            .status(403)
            .send('Forbidden')
    }
});

app.get('/', (req, res) => {
    const billID = req.query.id;
    const type = req.query.type;
    const sum = req.query.sum;
    const currency = req.query.cur;
    const sign = req.query.sign;
    const signBotTPlatform = signBOT_T(billID, type, sum, currency, botToken)
    if (signBotTPlatform === sign) {
        const amount = new BigNumber(sum)
            .dividedBy(100);
        const paymentTypeSign = signPaymentType(payOKSecret, type)
        const url = generatePayOK(
            payOKSecret,
            'Пополнение баланса пользователя',
            currency,
            shopID,
            billID,
            amount,
            type,
            paymentTypeSign
        )
        res.redirect(url)
    } else {
        res.setHeader('content-type', 'text/plain');
        res
            .status(403)
            .send('Forbidden')
    }
})

app.use((req, res) => {
    res.setHeader('content-type', 'text/plain');
    res
        .status(404)
        .send('Not found')
})


app.use((err, req, res, next) => {
    console.log(err)
    res
      .status(500)
      .send('Internal error');
})
app.listen(3000, () => {
    console.log(`App listening at http://localhost:3000`)
})
