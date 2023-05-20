$(document).ready(function () {
  const GPTModel = "gpt-3.5-turbo";
  const HuggingFacesModelsMap = {
    "FacebookBartLargeCNN": "facebook/bart-large-cnn",
  };

  $('.mw-headline').each(function () {
    var sectionHeading = $(this);
    var editLink = sectionHeading.siblings('.mw-editsection');
    var immediateParent = sectionHeading.parent();

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

  function fetchSummaryUsingOpenAPI(fixedPromptForChatGPT, openAPIKey, sectionText, callback) {

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
            content: fixedPromptForChatGPT + sectionText,
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

  function summarizeSection(sectionHeading) {
    const sectionParent = sectionHeading.parent();
    const selectedLLMModel = GPTModel;
    const LLMApiKey = localStorage.getItem('LLMApiKey');

    if (!LLMApiKey) {
      window.alert("Missing LLMApiKey key. Please set");
      return;
    }

    console.log("Found API Key:", LLMApiKey);
    var fixedPromptForChatGPT = "Summarize the following section in less than 50 words:  ";
    var sectionText = '';
    if (sectionParent.is('h2')) {
      const nextHeading = sectionParent.nextAll('h2, .mw-heading2, .mw-heading2, .ext-discussiontools-init-section').first();
      if (nextHeading.length === 0) {
        if (mw.config.get("wgCanonicalNamespace") === "Talk") {
          fixedPromptForChatGPT = "Summarize the following section in less than 50 words. See that each row represents a " +
            "reply from a user with the Username presented right before (talk). Use the usernames when summarizing"
          sectionText =  sectionParent.parent().nextUntil('.mw-heading').map(function() {
            return this.innerText;
          }).get();
        } else {
          sectionText = sectionParent.parent().nextUntil('.mw-heading', 'p').text();
        }
      } else {
        sectionText = sectionParent.nextUntil(nextHeading, 'p').text().trim();
      }
    }

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
});
