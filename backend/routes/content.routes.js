const express = require('express');
const Content = require('../models/content.model');
const { Configuration, OpenAIApi } = require('openai');
const router = express.Router();

// Configuration OpenAI
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

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

// Générer du contenu
router.post('/generate', auth, async (req, res) => {
    try {
        const { keywords, contentType, wordCount, language, aiModel } = req.body;

        // Vérifier l'utilisation de l'API
        if (req.user.apiUsage.currentUsage >= req.user.apiUsage.monthlyLimit) {
            return res.status(403).json({ message: 'Limite mensuelle atteinte.' });
        }

        // Construire le prompt pour l'IA
        const prompt = `Générer un article ${contentType} en ${language} de ${wordCount} mots 
                       sur les mots-clés suivants: ${keywords.join(', ')}. 
                       L'article doit être optimisé pour le SEO.`;

        // Appeler l'API OpenAI
        const completion = await openai.createCompletion({
            model: aiModel,
            prompt: prompt,
            max_tokens: Math.min(wordCount * 2, 4000),
            temperature: 0.7,
        });

        // Créer le contenu dans la base de données
        const content = new Content({
            title: `Article sur ${keywords[0]}`,
            content: completion.data.choices[0].text,
            keywords,
            language,
            contentType,
            wordCount,
            creator: req.user._id,
            aiModel
        });

        await content.save();

        // Mettre à jour l'utilisation de l'API
        req.user.apiUsage.currentUsage += 1;
        await req.user.save();

        res.status(201).json(content);
    } catch (error) {
        res.status(400).json({ message: 'Erreur lors de la génération.', error: error.message });
    }
});

// Obtenir tous les contenus de l'utilisateur
router.get('/my-content', auth, async (req, res) => {
    try {
        const contents = await Content.find({ creator: req.user._id })
            .sort({ createdAt: -1 });
        res.json(contents);
    } catch (error) {
        res.status(500).json({ message: 'Erreur lors de la récupération.', error: error.message });
    }
});

// Obtenir un contenu spécifique
router.get('/:id', auth, async (req, res) => {
    try {
        const content = await Content.findOne({
            _id: req.params.id,
            creator: req.user._id
        });

        if (!content) {
            return res.status(404).json({ message: 'Contenu non trouvé.' });
        }

        res.json(content);
    } catch (error) {
        res.status(500).json({ message: 'Erreur lors de la récupération.', error: error.message });
    }
});

// Mettre à jour un contenu
router.patch('/:id', auth, async (req, res) => {
    try {
        const content = await Content.findOne({
            _id: req.params.id,
            creator: req.user._id
        });

        if (!content) {
            return res.status(404).json({ message: 'Contenu non trouvé.' });
        }

        const updates = Object.keys(req.body);
        const allowedUpdates = ['title', 'content', 'keywords', 'status'];
        const isValidOperation = updates.every(update => allowedUpdates.includes(update));

        if (!isValidOperation) {
            return res.status(400).json({ message: 'Mises à jour invalides.' });
        }

        updates.forEach(update => content[update] = req.body[update]);
        await content.save();

        res.json(content);
    } catch (error) {
        res.status(400).json({ message: 'Erreur lors de la mise à jour.', error: error.message });
    }
});

// Supprimer un contenu
router.delete('/:id', auth, async (req, res) => {
    try {
        const content = await Content.findOneAndDelete({
            _id: req.params.id,
            creator: req.user._id
        });

        if (!content) {
            return res.status(404).json({ message: 'Contenu non trouvé.' });
        }

        res.json({ message: 'Contenu supprimé avec succès.' });
    } catch (error) {
        res.status(500).json({ message: 'Erreur lors de la suppression.', error: error.message });
    }
});

module.exports = router;
