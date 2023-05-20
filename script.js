/* jshint browser: true, jquery: true */
/* globals $, mw, OO */

// ==UserScript==
// @name         Wikipedia ChatGPT section summaries
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Experiment to use ChatGPT to summarize page sections.
// @author       tonythomas01
// @license      GPL-3.0-or-later
// @match        https://*.wikipedia.org/*
// @icon         https://doc.wikimedia.org/oojs-ui/master/demos/dist/themes/wikimediaui/images/icons/robot.svg
// @grant        none
// ==/UserScript==

(function () {
  const GPTModel = "gpt-3.5-turbo";
  const HuggingFacesModelsMap = {
    "FacebookBartLargeCNN": "facebook/bart-large-cnn",
  };

  function main() {
    $('.mw-headline').each(function () {
      var sectionHeading = $(this);
      const editLink = sectionHeading.siblings('.mw-editsection');
      const immediateParent = sectionHeading.parent();

      if (immediateParent.is('h2') || immediateParent.is('.mw-heading2')) {
        var summarizeLink = $('<span>')
          .addClass('mw-summarysection')
          .addClass('mw-editsection')
          .css('margin-left', '0.5em')
          .append(
            $('<span>')
              .addClass('mw-editsection-bracket')
              .text('[')
          )
          .append(
            $('<a>')
              .attr('href', '#')
              .text('summarize')
              .click(function (e) {
                e.preventDefault();
                summarizeSection(sectionHeading);
              })
          )
          .append(
            $('<span>')
              .addClass('mw-editsection-bracket')
              .text(']')
          );

        editLink.after(summarizeLink);
      }
    });
  }

  function loadMain() {
    if (!window.$) {
      return setTimeout(loadMain, 50);
    }
    $(main);
  }
  loadMain();

  function fetchSummaryUsingOpenAPI(fixedPromptForChatGPT, openAPIKey, sectionText, callback) {
    const gptQuery = fixedPromptForChatGPT + sectionText;
    console.log("To GPT: ", gptQuery);

    $.ajax({
      url: "https://api.openai.com/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + openAPIKey,
      },
      data: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "user",
            content: gptQuery
          }
        ],
        temperature: 0.7
      }),
      success: function (response) {
        const responseContent = response.choices[0].message.content;
        callback(null, responseContent);
      },
      error: function (error) {
        callback(error);
      }
    });
  }

  function fetchSummaryUsingHuggingFacesModel(apiKeySecret, modelName, sectionText, callback) {
    $.ajax({
      url: "https://api-inference.huggingface.co/models/" + modelName,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKeySecret,
      },
      data: JSON.stringify({
        inputs: sectionText
      }),
      success: function (response) {
        const responseContent = response[0].summary_text;
        callback(null, responseContent);
      },
      error: function (error) {
        callback(error);
      }
    });
  }

  function onSummaryFetch(error, responseContent) {
    if (error) {
      console.log(error);
    } else {
      console.log("LLM model responded: " + responseContent);
    }
  }

  function getSectionTextUnderHeading(pageType, sectionParent) {
    if (pageType === "Talk") {
      // These can be both 'p' and 'dl'
      return  sectionParent.parent().nextUntil('.mw-heading').map(function () {
        return this.innerText;
      }).get();
    } else {
      return sectionParent.nextUntil('h2', 'p').map(function () {
        return this.innerText;
      }).get().join("\n");
    }
  }

    var apiKey = null;
    /**
     * @return {string}
     */
    function getApiKey() {
        if ( apiKey ) {
            return apiKey;
        }

        apiKey = localStorage.getItem( 'LLMApiKey' );
        if ( apiKey ) {
            return apiKey;
        }

        apiKey = prompt( 'Please enter your OpenAI API key from https://platform.openai.com/account/api-keys' );
        if ( !apiKey ) {
            throw new Error( 'Section summary requires an API key!' );
        }
        localStorage.setItem( 'LLMApiKey', apiKey );
    }

  function summarizeSection(sectionHeading) {
    const sectionParent = sectionHeading.parent();
    const selectedLLMModel = GPTModel;
    const LLMApiKey = getApiKey();

    var fixedPromptForChatGPT = "Summarize the following section in less than 50 words:  ";
    const pageType = mw.config.get("wgCanonicalNamespace");
    if (pageType === "Talk") {
      fixedPromptForChatGPT = "Summarize the following section in less than 50 words. See that each row represents a " +
        "reply from a user with the Username presented right before  (talk). Use the usernames when summarizing. \n";
    }
    const sectionText = getSectionTextUnderHeading(pageType, sectionParent);

    console.log("Found Section Text:", sectionText);

    switch (selectedLLMModel) {
      case GPTModel:
        fetchSummaryUsingOpenAPI(fixedPromptForChatGPT, LLMApiKey, sectionText, onSummaryFetch);
        return;
      default:
        fetchSummaryUsingHuggingFacesModel(LLMApiKey, HuggingFacesModelsMap[selectedLLMModel], sectionText, onSummaryFetch);
        return;
    }
  }
})();
