// eslint-disable-next-line import/no-extraneous-dependencies
const Fastq = require('fastq');
const { Github: GithubAdapter } = require('../adapter/github.adapter');

// TODO refactor add constants
const STATISTICS_TYPE = { year: 'year', all: 'all' };

class Github {
 async getTopRepositories({ repo, owner, type }) {
  // TODO refactor
  let responses;
  if (type === STATISTICS_TYPE.year) {
   responses = await this.getTopRepositoriesLastYear({ owner, repo });
  } else if (type === STATISTICS_TYPE.all) {
   responses = await this.getTopRepositoriesAll({ owner, repo });
  }
  return { data: responses, count: responses.length };
 }

 // recently = ~1year, check documentation Github api
 async getTopRepositoriesLastYear({ repo, owner }) {
  const userContributors = await this.#getUserContributors({ owner, repo });
  return this.getRepoContributedToLastYear({ repo, owner, userContributors });
 }

 async getTopRepositoriesAll({ owner, repo }) {
  const contributors = await this.getUserContributors({ owner, repo });
  const topDuplicates = await this.#getRepoContributedToLastYear({
   repo,
   owner,
   count: 20,
   userContributors: contributors,
  });

  const countContributors = {};
  const queueGetuserRepoUniq = Fastq.promise(async (task) => {
   const { contributors: localContributors, owner: repoOwner, repo: _repo, url } = await task();

   const fullName = `${repoOwner}_${_repo}`;

   localContributors.forEach((obj) => {
    const { login } = obj;
    if (contributors.some((objData) => objData.login === login)) {
     if (countContributors[fullName]) {
      countContributors[fullName].count += 1;
     } else {
      countContributors[fullName] = {
       count: 1,
       url,
       owner: repoOwner,
       name: _repo,
      };
     }
    }
   });
  }, 20);

  for (const repositoryTop of topDuplicates) {
   queueGetuserRepoUniq.push(async () => {
    const { owner: repoOwner, name } = repositoryTop;

    const localContributors = await this.#getUserContributors({ repo: name, owner: repoOwner });

    return { contributors: localContributors, owner: repoOwner, repo: name, url: repositoryTop.url };
   });
  }

  await new Promise((resolve) => {
   queueGetuserRepoUniq.drain = resolve;
  });

  const countsArrayUser = Object.keys(countContributors).map((name) => ({ ...countContributors[name] }));

  countsArrayUser.sort((a, b) => b.count - a.count);

  const topDuplicatesUSerinRepo = countsArrayUser.slice(0, 5);

  return topDuplicatesUSerinRepo;
 }

 async #getRepoContributedToLastYear({ repo, count = 5, userContributors }) {
  const countsRepository = {};
  const queueGetuserRepo = Fastq.promise(async (task) => {
   const repos = await task();

   repos.forEach((obj) => {
    const url = new URL(obj.url);

    const repoOwner = url.pathname.split('/')[1];
    const repositoryName = url.pathname.split('/')[2];
    // TODO refactor
    if (repositoryName !== repo) {
     const fullName = `${repoOwner}_${repositoryName}`;

     if (countsRepository[fullName]) {
      countsRepository[fullName].count++;
     } else {
      countsRepository[fullName] = {
       count: 1,
       url,
       owner: repoOwner,
       name: repositoryName,
      };
     }
    }
   });

   return true;
  }, 20);

  for (const contributor of userContributors) {
   queueGetuserRepo.push(async () => {
    return this.#getUserRepo(contributor.login);
   });
  }

  await new Promise((resolve) => {
   queueGetuserRepo.drain = resolve;
  });

  const countsArray = Object.keys(countsRepository).map((name) => ({
   ...countsRepository[name],
  }));
  countsArray.sort((a, b) => b.count - a.count);
  const topDuplicates = countsArray.slice(0, count);

  return topDuplicates;
 }

 async #getUserRepo(username) {
  try {
   const query = `
      {
        user(login: "${username}") {
          repositoriesContributedTo(first: 99) {
            nodes {
              name
              url
            }
          }
        }
      }
    `;

   const data = await GithubAdapter.postGraphQLQuery({ query });
   return data.data?.user.repositoriesContributedTo.nodes || [];
  } catch (error) {
   throw new Error(`Failed to fetch repositories for ${username}: ${error.message}`);
  }
 }

 async #getUserContributors({ owner, repo }) {
  let currentPage = 0;
  const contributors = [];

  while (true) {
   const data = await GithubAdapter.getContributors({ page: currentPage, repo, owner, type: 'all' });
   contributors.push(...data);
   if (data.length === 0 || data.length < 100) break;
   currentPage++;
  }

  return contributors.filter((_user) => {
   return _user.type === 'User'; // Виправлено: Замінено '==' на
   '==='
  });
 }
}

module.exports = { Github };
