const { Github: GithubService } = require('../services/github.service');

class Github {
 // query {owner,repo, type }
 static async getTopContributors(req, res) {
  try {
   const { owner, repo, type } = req.query; // Виправлено: Додано repo та type до деструктуризації req.query

   if (!owner || !repo || !type) {
    // Виправлено: Змінено назву repos на repo
    return res.status(400).json({ err: 'owner, repo, type request field' }); // Виправлено: Змінено "repos" на "repo"
   }

   const response = await GithubService.getTopRepositories({ owner, repo, type }); // Виправлено: Змінено "typu" на "type"

   return res.send(response);
  } catch (error) {
   // Виправлено: Змінено "errоr" на "error"
   return res.status(500).json(error.message);
  }
 }
}

module.exports = { Github };
