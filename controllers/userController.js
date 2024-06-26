const express = require('express');
const User = require('../models/user');
const Follows = require('../models/follows');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const Bookmarks = require('../models/bookmark');




const maxAge = 3 * 24 * 60 * 60;

/**
    * @openapi
    * '/api/login':
    *  post:
    *     tags:
    *     - User Controller
    *     summary: Login as a user
    *     requestBody:
    *      required: true
    *      content:
    *        application/json:
    *           schema:
    *            type: object
    *            required:
    *              - email
    *              - password
    *            properties:
    *              email:
    *                type: string
    *                default: "karthikvelou@optisolbusiness.com"
    *              password:
    *                type: string
    *                default: "12345"
    *     responses:
    *      201:
    *        description: Succesfully logged In
    *      409:
    *        description: Conflict
    *      404:
    *        description: Not Found
    *      500:
    *        description: Server Error
    */

const login = async (req, res) => {

    try {
        const { email, password } = req.body;

        let user = await User.findOne({ email });

        if (user) {
            let comparePassword = await bcrypt.compare(password, user.password);

            if (comparePassword) {
                let id = user._id

                let token = jwt.sign({ id }, 'posts-login', { expiresIn: maxAge });

                let refreshToken = jwt.sign({ id }, 'posts-login', { expiresIn: '1d' });

                let tokenupdate = await User.findOneAndUpdate({ email: email }, { token: token }, { new: true }).select(['name', 'email', 'mobile', 'gender', 'token']);

                return res.cookie('refreshToken', refreshToken, { httpOnly: true, sameSite: 'strict' })
                    .json({ 'status': true, 'message': 'successfully logged in', 'data': tokenupdate });
            }
            return res.status(400).json({ 'status': false, 'message': 'Incorrect password' })
        }

        return res.status(400).json({ 'status': false, 'message': 'Incorrect email' });
    }
    catch (err) {
        console.log("Error", err);
        return res.status(400).json({ 'status': false, 'message': err });
    }

}


/**
     * @openapi
     * '/api/register':
     *  post:
     *     tags:
     *     - User Controller
     *     summary: Create a user
     *     requestBody:
     *      required: true
     *      content:
     *        application/json:
     *           schema:
     *            type: object
     *            required:
     *              - name
     *              - email
     *              - password
     *              - gender
     *              - mobile
     *            properties:
     *              name:
     *                type: string
     *                default: johndoe 
     *              email:
     *                type: string
     *                default: johndoe@mail.com
     *              password:
     *                type: string
     *                default: johnDoe20!@
     *              gender:
     *                type: string
     *                default: Male
     *              mobile:
     *                type: number
     *                default: 91980980008
     *     responses:
     *      201:
     *        description: Created
     *      409:
     *        description: Conflict
     *      404:
     *        description: Not Found
     *      500:
     *        description: Server Error
     */

const register = async (req, res) => {

    try {
        const { name, email, mobile, password, gender } = req.body;


        const check = await User.find({ email: email, mobile: mobile });

        const salt = await bcrypt.genSalt();

        let encryptPassword = await bcrypt.hash(password, salt);


        if (check.length > 0) {
            return res.status(400).json({ 'status': false, 'message': 'Users already exists' });
        }

        let user = await User.create({ name: name, email: email, mobile: mobile, password: encryptPassword, gender: gender })

        if (user) {

            let id = user._id;

            let token = jwt.sign({ id }, 'posts-login', { expiresIn: maxAge });

            await User.findOneAndUpdate({ email: email }, { token: token }, { new: true });

            return res.status(200).json({ 'status': true, 'message': "You account is registered successfully" });
        }
    }
    catch (err) {
        return res.status(400).json({ 'status': false, 'message': err });
    }

}

const getToken = (req) => {
    const token = req.headers.authorization.split(" ");

    const secret = 'posts-login';

    const decoded = jwt.verify(token[1], secret);

    return decoded.id;
}

const refreshtokens = (req, res) => {
    const refreshToken = req.cookies['refreshToken'];
    if (!refreshToken) {
        return res.status(401).send('Access Denied. No refresh token provided.');
    }

    try {
        const decoded = jwt.verify(refreshToken, secretKey);
        const accessToken = jwt.sign({ user: decoded.user }, secretKey, { expiresIn: '1h' });

        res
            .header('Authorization', accessToken)
            .send(decoded.user);
    } catch (error) {
        return res.status(400).send('Invalid refresh token.');
    }
}

const myaccount = async (req, res) => {

    try {
        let userId = getToken(req);

        let users = await User.findById(userId).select(['name', 'email', 'mobile', 'gender', 'token']);

        let followers = await Follows.find({ user_id: userId }).populate('follow_id', ['name', 'email', 'mobile']);

        let bookmarks = await Bookmarks.find({ user_id: userId, status: 1 }).populate('post_id');

        return res.status(200).json({ 'status': true, 'message': "You account details", 'user': users, 'followers': followers, 'bookmarks': bookmarks });
    }
    catch (e) {
        return res.status(400).json({ 'status': false, 'message': e });
    }
}

const listUsers = async (req, res) => {

    let transporter = nodemailer.createTransport({
        host: "sandbox.smtp.mailtrap.io",
        port: 2525,
        auth: {
            user: "ce6336b4ae43ef",
            pass: "8c6c4d4241e3ed"
        }
    });

    let mailOptions = {
        from: 'karthikvelou93@gmail.com',
        to: 'karthikvelou@optisolbusiness.com',
        subject: 'Sending Email using Node.js',
        text: 'That was easy!'
    };

    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });

    try {

        let user_id = getToken(req);

        let list_user = await User.find({ _id: { $ne: user_id } });

        let follows = await Follows.find({ user_id: user_id, status: true }).distinct('follow_id');

        let followingUsers = list_user.map((user) => {

            let follow = follows.filter((f) => f == user._id.toString() ? true : false);
            return {
                _id: user._id,
                name: user.name,
                email: user.email,
                isFollowed: follow[0] ? true : false
            }
        })

        return res.status(200).json({ 'status': true, 'message': "followers lists", 'user': followingUsers });
    }
    catch (e) {
        return res.status(400).json({ 'status': false, 'message': e });
    }
}

const followUser = async (req, res) => {
    try {

        const { follow_id, status } = req.body;

        let user_id = getToken(req);

        let check = await Follows.findOne({ user_id: user_id, follow_id: follow_id });

        let message = '';

        if (status == 1) {
            message = "user followed successfully";
        }
        else {
            message = "user unfollowed successfully";
        }

        if (!check) {
            let follows = await Follows.create({ user_id: user_id, follow_id: follow_id, status: status });

            if (follows) {
                return res.status(200).json({ 'status': true, 'message': message });
            }
        }
        else {
            let follows = await Follows.findOneAndUpdate({ user_id: user_id, follow_id: follow_id }, { status: status }).exec();

            if (follows) {

                return res.status(200).json({ 'status': true, 'message': message });
            }
        }


        return res.status(200).json({ 'status': true, 'message': "user already followed" });
    }
    catch (e) {
        return res.status(400).json({ 'status': false, 'message': e });
    }
}

module.exports = {
    login,
    register,
    myaccount,
    listUsers,
    followUser,
    refreshtokens
}