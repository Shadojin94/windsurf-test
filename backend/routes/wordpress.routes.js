const express = require('express');
const axios = require('axios');
const router = express.Router();

// Middleware d'authentification (à importer du auth.routes.js)
const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization').replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: decoded.userId });

        if (!user) {
            throw new Error();
        }

        req.user = user;
        req.token = token;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Veuillez vous authentifier.' });
    }
};

// Ajouter un site WordPress
router.post('/sites', auth, async (req, res) => {
    try {
        const { url, username, appPassword } = req.body;

        // Vérifier la connexion au site WordPress
        const wpApi = `${url}/wp-json/wp/v2`;
        const auth = Buffer.from(`${username}:${appPassword}`).toString('base64');

        try {
            await axios.get(wpApi, {
                headers: { 'Authorization': `Basic ${auth}` }
            });
        } catch (error) {
            return res.status(400).json({ message: 'Impossible de se connecter au site WordPress.' });
        }

        // Ajouter le site à l'utilisateur
        req.user.wpSites.push({ url, username, appPassword });
        await req.user.save();

        res.status(201).json({ message: 'Site WordPress ajouté avec succès.' });
    } catch (error) {
        res.status(400).json({ message: 'Erreur lors de l\'ajout du site.', error: error.message });
    }
});

// Publier un contenu sur WordPress
router.post('/publish/:contentId', auth, async (req, res) => {
    try {
        const { siteId } = req.body;
        const content = await Content.findOne({
            _id: req.params.contentId,
            creator: req.user._id
        });

        if (!content) {
            return res.status(404).json({ message: 'Contenu non trouvé.' });
        }

        const site = req.user.wpSites.id(siteId);
        if (!site) {
            return res.status(404).json({ message: 'Site WordPress non trouvé.' });
        }

        // Préparer les données pour WordPress
        const postData = {
            title: content.title,
            content: content.content,
            status: 'publish'
        };

        // Publier sur WordPress
        const wpApi = `${site.url}/wp-json/wp/v2/posts`;
        const auth = Buffer.from(`${site.username}:${site.appPassword}`).toString('base64');

        const response = await axios.post(wpApi, postData, {
            headers: { 
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            }
        });

        // Mettre à jour le contenu avec l'ID du post WordPress
        content.wpSiteId = siteId;
        content.wpPostId = response.data.id;
        content.status = 'published';
        await content.save();

        res.json({ 
            message: 'Contenu publié avec succès sur WordPress.',
            wpPostId: response.data.id,
            wpPostUrl: response.data.link
        });
    } catch (error) {
        res.status(400).json({ message: 'Erreur lors de la publication.', error: error.message });
    }
});

// Planifier une publication
router.post('/schedule/:contentId', auth, async (req, res) => {
    try {
        const { siteId, publishDate } = req.body;
        const content = await Content.findOne({
            _id: req.params.contentId,
            creator: req.user._id
        });

        if (!content) {
            return res.status(404).json({ message: 'Contenu non trouvé.' });
        }

        const site = req.user.wpSites.id(siteId);
        if (!site) {
            return res.status(404).json({ message: 'Site WordPress non trouvé.' });
        }

        // Préparer les données pour WordPress
        const postData = {
            title: content.title,
            content: content.content,
            status: 'future',
            date: publishDate
        };

        // Planifier sur WordPress
        const wpApi = `${site.url}/wp-json/wp/v2/posts`;
        const auth = Buffer.from(`${site.username}:${site.appPassword}`).toString('base64');

        const response = await axios.post(wpApi, postData, {
            headers: { 
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            }
        });

        // Mettre à jour le contenu
        content.wpSiteId = siteId;
        content.wpPostId = response.data.id;
        content.status = 'scheduled';
        content.publishDate = publishDate;
        await content.save();

        res.json({ 
            message: 'Publication planifiée avec succès.',
            wpPostId: response.data.id,
            scheduledDate: publishDate
        });
    } catch (error) {
        res.status(400).json({ message: 'Erreur lors de la planification.', error: error.message });
    }
});

module.exports = router;
