import React, { Component } from "react";
import { Meteor } from "meteor/meteor";
import { Button, SettingsCard } from "@reactioncommerce/reaction-ui";
import loadOrders from "../mutations/loadOrders";
import loadProductImages from "../mutations/loadProductImages";
import loadProductsAndTags from "../mutations/loadProductsAndTags";
import resetDevtoolData from "../mutations/resetDevtoolData";

class DevTools extends Component {
  handleResetData = async () => {
    const { client } = this.props;

    try {
      await client.mutate({
        mutation: resetDevtoolData,
        variables: {
          input: {}
        }
      });

      Alerts.toast("Database flushed successfully", "success");
    } catch (err) {
      Alerts.toast(`Error flushing the database ${err}`, "error");
    }
  }

  handleSwagShopImagesClick = () => {
    Meteor.call("devtools/loaddata/images", "swagshop", (error) => {
      if (error) {
        Alerts.toast(`Error loading images ${error.reason}`, "error");
      } else {
        Alerts.toast("Images loaded successfully", "success");
      }
    });
  }

  handleImagesClick = () => {
    Meteor.call("devtools/loaddata/images", (error) => {
      if (error) {
        Alerts.toast(`Error loading images ${error.reason}`, "error");
      } else {
        Alerts.toast("Images loaded successfully", "success");
      }
    });
  }

  handleImagesFromWebClick = async () => {
    const { client } = this.props;

    try {
      await client.mutate({
        mutation: loadProductImages,
        variables: {
          input: {
            source: "web"
          }
        }
      });

      Alerts.toast("Images loaded successfully", "success");
    } catch (err) {
      Alerts.toast(`Error loading images ${err}`, "error");
    }
  }

  handleLoadProductsAndTags = async (size) => {
    const { client } = this.props;

    try {
      await client.mutate({
        mutation: loadProductsAndTags,
        variables: {
          input: {
            size
          }
        }
      });

      Alerts.toast("Products and tags loaded successfully", "success");
    } catch (err) {
      Alerts.toast(`Error loading large sample data ${err}`, "error");
    }
  }

  handleLoadOrders = async (desiredOrderCount) => {
    const { client } = this.props;

    try {
      await client.mutate({
        mutation: loadOrders,
        variables: {
          input: {
            desiredOrderCount
          }
        }
      });

      Alerts.toast("Orders loaded successfully", "success");
    } catch (err) {
      Alerts.toast(`Error loading order data ${err}`, "error");
    }
  }

  render() {
    return (
      <div>
        <SettingsCard
          title={"Common"}
          expanded={true}
          showSwitch={false}
        >
          <Button
            bezelStyle={"solid"}
            primary={true}
            label={"Reset Data"}
            onClick={this.handleResetData}
          />
        </SettingsCard>

        <SettingsCard
          title={"Small shop data (10 products, 100 orders)"}
          expanded={true}
          showSwitch={false}
        >
          <Button
            bezelStyle={"solid"}
            primary={true}
            label={"Load Products and Tags"}
            onClick={() => this.handleLoadProductsAndTags("small")}
          />
          <br />
          <br />
          <Button
            bezelStyle={"solid"}
            primary={true}
            label={"Load Orders"}
            onClick={() => this.handleLoadOrders(100)}
          />
          <br />
          <br />
          <Button
            bezelStyle={"solid"}
            primary={true}
            label={"Load Images"}
            onClick={this.handleSwagShopImagesClick}
          />

          <br />
          <br />
          <Button
            bezelStyle={"solid"}
            primary={true}
            label={"Load Puppy Images"}
            onClick={this.handleImagesFromWebClick}
          />
        </SettingsCard>


        <SettingsCard
          title={"Medium Dataset (1000 products, 10000 orders)"}
          expanded={true}
          showSwitch={false}
        >
          <Button
            bezelStyle={"solid"}
            primary={true}
            label={"Load Products and Tags"}
            onClick={() => this.handleLoadProductsAndTags("medium")}
          />
          <br />
          <br />
          <Button
            bezelStyle={"solid"}
            primary={true}
            label={"Load Orders"}
            onClick={() => this.handleLoadOrders(10000)}
          />
          <br />
          <br />
          <Button
            bezelStyle={"solid"}
            primary={true}
            label={"Load Images"}
            onClick={this.handleImagesClick}
          />
          <div>Loading images may take some time</div>
        </SettingsCard>

        <SettingsCard
          title={"Large Dataset (50,000 products, 50,000 orders)"}
          expanded={true}
          showSwitch={false}
        >
          <Button
            bezelStyle={"solid"}
            primary={true}
            label={"Load Products and Tags"}
            onClick={() => this.handleLoadProductsAndTags("large")}
          />
          <br />
          <br />
          <Button
            bezelStyle={"solid"}
            primary={true}
            label={"Load Orders"}
            onClick={() => this.handleLoadOrders(50000)}
          />
          <br />
          <br />
          <Button
            bezelStyle={"solid"}
            primary={true}
            label={"Load Images"}
            onClick={this.handleImagesClick}
          />
          <div>Loading images may take some time</div>
        </SettingsCard>
      </div>
    );
  }
}

export default DevTools;
